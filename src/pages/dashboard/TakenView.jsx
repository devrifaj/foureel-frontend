import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, DragOverlay, useDroppable, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getTasks, getClients, createTask, updateTask, archiveTask } from '../../api';
import { useLang } from '../../context/LangContext';

const COLS = [{ id: 'todo' }, { id: 'bezig' }, { id: 'review' }, { id: 'klaar' }];
const TEAM = ['Paolo', 'Lex', 'Rick', 'Ray', 'Boy'];

const ASSIGNEE = {
  Paolo: { bg: 'var(--accent)', init: 'P' },
  Lex:   { bg: 'var(--sage)', init: 'L' },
  Rick:  { bg: 'var(--amber)', init: 'R' },
  Ray:   { bg: 'var(--blue)', init: 'Ra' },
  Boy:   { bg: 'var(--purple)', init: 'B' },
};

function prioClass(priority) {
  const p = String(priority || 'Normal').toLowerCase();
  if (p === 'high') return 'prio-high';
  if (p === 'low') return 'prio-low';
  return 'prio-normal';
}

function TaskCardContent({ task }) {
  const av = ASSIGNEE[task.assignee] || { bg: 'var(--text-3)', init: task.assignee?.[0] || '?' };
  return (
    <>
      <div className="task-title">{task.title}</div>
      {task.client ? (
        <div className="task-meta">
          <span className="task-client">{task.client}</span>
        </div>
      ) : null}
      <div className="task-footer">
        <div className="task-avatar" style={{ background: av.bg }}>{av.init}</div>
        <span className="task-due">{task.dueDate ? `📅 ${task.dueDate}` : ''}</span>
      </div>
    </>
  );
}

function TaskCard({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${prioClass(task.priority)}${isDragging ? ' dragging' : ''}`}
      onClick={() => onClick(task)}
    >
      <button
        type="button"
        aria-label="Sleep taak"
        title="Sleep taak"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="btn btn-ghost btn-sm task-drag-handle"
      >
        ⋮⋮
      </button>
      <TaskCardContent task={task} />
    </div>
  );
}

function KanbanColumn({ columnId, title, count, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <div ref={setNodeRef} className={`kanban-col${isOver ? ' is-over' : ''}`} data-col={columnId}>
      <div className="col-header">
        <span className="col-title">{title}</span>
        <span className="col-count">{count}</span>
      </div>
      {children}
    </div>
  );
}

export default function TakenView() {
  const { t } = useLang();
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
  );
  const [filter, setFilter] = useState('all');
  const [activeId, setActiveId] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [taskModal, setTaskModal] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    title: '',
    assignee: 'Paolo',
    priority: 'Normal',
    dueDate: '',
    clientId: '',
    column: 'todo',
  });
  const qc = useQueryClient();
  const boardRef = useRef(null);

  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: getTasks });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: getClients });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => updateTask(id, d),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = qc.getQueryData(['tasks']) || [];

      qc.setQueryData(['tasks'], (current = []) =>
        current.map((task) => (task._id === id ? { ...task, ...data } : task)),
      );

      if (taskModal?._id === id) {
        setTaskModal((prev) => (prev ? { ...prev, ...data } : prev));
      }

      return { previousTasks };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        qc.setQueryData(['tasks'], context.previousTasks);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
  const createMut = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      qc.invalidateQueries(['tasks']);
      setNewModal(false);
      setForm({
        title: '',
        assignee: 'Paolo',
        priority: 'Normal',
        dueDate: '',
        clientId: '',
        column: 'todo',
      });
    },
  });
  const archiveMut = useMutation({
    mutationFn: ({ id, archivedReason }) => archiveTask(id, archivedReason),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = qc.getQueryData(['tasks']) || [];
      qc.setQueryData(['tasks'], (current = []) =>
        current.filter((task) => task._id !== id),
      );
      setTaskModal(null);
      setToast('Task archived');
      return { previousTasks };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        qc.setQueryData(['tasks'], context.previousTasks);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['archivedTasks'] });
    },
    onSettled: () => {
      setTimeout(() => setToast(null), 1800);
    },
  });

  const filtered = filter === 'all' ? tasks : tasks.filter((x) => x.assignee === filter);

  const handleDragEnd = ({ active, over }) => {
    if (!over) {
      setActiveId(null);
      return;
    }
    let nextCol = null;
    const overId = String(over.id);
    if (COLS.some((c) => c.id === overId)) {
      nextCol = overId;
    } else {
      const overTask = filtered.find((t) => t._id === overId) || tasks.find((t) => t._id === overId);
      nextCol = overTask?.column || null;
    }
    const activeTaskItem = tasks.find((t) => t._id === active.id);
    if (nextCol && activeTaskItem?.column !== nextCol) {
      updateMut.mutate({ id: active.id, column: nextCol });
    }
    setActiveId(null);
  };

  const activeTask = tasks.find((x) => x._id === activeId);

  const filters = [{ id: 'all', lbl: t('allTasks') }, ...TEAM.map((n) => ({ id: n, lbl: n }))];

  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return undefined;

    const updateProgress = () => {
      if (window.innerWidth > 900) return;
      const maxScroll = Math.max(1, boardEl.scrollWidth - boardEl.clientWidth);
      const nextProgress = Math.max(0, Math.min(1, boardEl.scrollLeft / maxScroll));
      setScrollProgress(nextProgress);
    };

    const onScroll = () => window.requestAnimationFrame(updateProgress);
    boardEl.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();

    return () => {
      boardEl.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateProgress);
    };
  }, [filter, filtered.length]);

  const scrollToColumn = (idx) => {
    const boardEl = boardRef.current;
    if (!boardEl) return;
    const columns = boardEl.querySelectorAll('.kanban-col');
    const target = columns[idx];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  return (
    <section className="view active taken-view">
      <div className="page-header taken-page-header">
        <div className="taken-page-title-wrap">
          <div className="page-title">Taken <em>— Kanban board</em></div>
          <div className="page-subtitle">{t('tasksKanbanSubtitle')}</div>
        </div>
        <button type="button" className="btn btn-primary taken-add-btn" onClick={() => setNewModal(true)}>{t('addTask')}</button>
      </div>

      <div className="kanban-header">
        <div className="filter-bar">
          <span className="filter-bar-label">{t('filter')}</span>
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-btn${filter === f.id ? ' active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.id !== 'all' && (
                <div className={`filter-avatar${f.id === 'Paolo' ? ' av-P' : ''}`} style={{ background: ASSIGNEE[f.id].bg }}>
                  {ASSIGNEE[f.id].init}
                </div>
              )}
              {f.lbl}
            </button>
          ))}
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="kanban-board" ref={boardRef}>
          {COLS.map((col) => {
            const colTasks = filtered.filter((x) => x.column === col.id);
            return (
              <SortableContext key={col.id} items={colTasks.map((x) => x._id)} strategy={verticalListSortingStrategy}>
                <KanbanColumn columnId={col.id} title={t(col.id)} count={colTasks.length}>
                  {colTasks.map((task) => (
                    <TaskCard key={task._id} task={task} onClick={setTaskModal} />
                  ))}
                  {col.id === 'todo' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
                      onClick={() => setNewModal(true)}
                    >
                      {t('addTask')}
                    </button>
                  )}
                </KanbanColumn>
              </SortableContext>
            );
          })}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className={`task-card ${prioClass(activeTask.priority)} dragging`}>
              <TaskCardContent task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <div
        className="kanban-mobile-fab-indicator"
        aria-label="Kolom navigator"
        style={{ '--fab-count': COLS.length }}
      >
        <span
          className="kanban-mobile-fab-thumb"
          style={{ transform: `translateX(calc(${scrollProgress} * var(--fab-track-x)))` }}
        />
        {COLS.map((col, idx) => (
          <button
            key={col.id}
            type="button"
            className="kanban-mobile-fab-dot"
            aria-label={`Ga naar ${t(col.id)}`}
            onClick={() => scrollToColumn(idx)}
          />
        ))}
      </div>

      {taskModal && (
        <div className="modal-overlay open" onClick={() => setTaskModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{taskModal.title}</div>
              <button type="button" className="modal-close" onClick={() => setTaskModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                {[['Klant', taskModal.client || '—'], ['Toegewezen', taskModal.assignee], ['Deadline', taskModal.dueDate || '—'], ['Prioriteit', taskModal.priority]].map(([l, v]) => (
                  <div key={l} style={{ background: 'var(--bg-alt)', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '3px' }}>{l}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{v}</div>
                  </div>
                ))}
              </div>
              {taskModal.description && <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px', padding: '12px', background: 'var(--bg-alt)', borderRadius: '8px' }}>{taskModal.description}</p>}
              {(taskModal.checklist || []).length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>Checklist</div>
                  {taskModal.checklist.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: item.done ? 'var(--sage)' : 'white', border: `1.5px solid ${item.done ? 'var(--sage)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white' }}>{item.done ? '✓' : ''}</div>
                      <div style={{ fontSize: '13px', textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--text-3)' : 'var(--text)' }}>{item.text}</div>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>Verplaats naar</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {COLS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      className={`btn btn-sm ${taskModal.column === col.id ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => {
                        updateMut.mutate({ id: taskModal._id, column: col.id });
                        setTaskModal({ ...taskModal, column: col.id });
                      }}
                    >
                      {t(col.id)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                 className="btn btn-ghost"
                style={{ marginRight: 'auto' }}
                onClick={() =>
                  archiveMut.mutate({
                    id: taskModal._id,
                    archivedReason: taskModal.column === 'klaar' ? 'completed' : 'manual',
                  })
                }
              >
                {t('archive')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setTaskModal(null)}>{t('close')}</button>
            </div>
          </div>
        </div>
      )}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '24px',
            background: 'var(--text)',
            color: 'white',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '12px',
            zIndex: 1200,
            boxShadow: 'var(--shadow)',
          }}
        >
          {toast}
        </div>
      ) : null}

      {newModal && (
        <div className="modal-overlay open" onClick={() => setNewModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Nieuwe taak aanmaken</div>
              <button type="button" className="modal-close" onClick={() => setNewModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Titel</label>
                <input className="form-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Taaknaam…" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Toegewezen aan</label>
                  <select className="form-input" value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}>
                    {TEAM.map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Prioriteit</label>
                  <select className="form-input" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                    <option>High</option>
                    <option>Normal</option>
                    <option>Low</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline</label>
                  <input type="date" className="form-input" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Klant</label>
                  <select
                    className="form-input"
                    value={form.clientId}
                    onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                  >
                    <option value="">— Kies klant —</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setNewModal(false)}>{t('cancel')}</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const selectedClient = clients.find((c) => String(c._id) === String(form.clientId));
                  createMut.mutate({
                    ...form,
                    clientId: form.clientId || undefined,
                    client: selectedClient?.name || '',
                  });
                }}
                disabled={!form.title}
              >
                Taak aanmaken
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

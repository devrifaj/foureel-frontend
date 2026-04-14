import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, DragOverlay, useDroppable } from '@dnd-kit/core';
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
      {...attributes}
      {...listeners}
      className={`task-card ${prioClass(task.priority)}${isDragging ? ' dragging' : ''}`}
      onClick={() => onClick(task)}
    >
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
  const [filter, setFilter] = useState('all');
  const [activeId, setActiveId] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [form, setForm] = useState({ title: '', assignee: 'Paolo', priority: 'Normal', dueDate: '', client: '', column: 'todo' });
  const qc = useQueryClient();

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
      setForm({ title: '', assignee: 'Paolo', priority: 'Normal', dueDate: '', client: '', column: 'todo' });
    },
  });
  const archiveMut = useMutation({
    mutationFn: ({ id }) => archiveTask(id),
    onSuccess: () => {
      qc.invalidateQueries(['tasks']);
      setTaskModal(null);
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

  return (
    <section className="view active">
      <div className="page-header">
        <div>
          <div className="page-title">Taken <em>— Kanban board</em></div>
          <div className="page-subtitle">{t('tasksKanbanSubtitle')}</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setNewModal(true)}>{t('addTask')}</button>
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
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="kanban-board">
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
              <button type="button" className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={() => archiveMut.mutate({ id: taskModal._id })}>{t('archive')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setTaskModal(null)}>{t('close')}</button>
            </div>
          </div>
        </div>
      )}

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
                  <select className="form-input" value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}>
                    <option value="">— Kies klant —</option>
                    {clients.map((c) => <option key={c._id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setNewModal(false)}>{t('cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={() => createMut.mutate(form)} disabled={!form.title}>Taak aanmaken</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getArchivedTasks, getClients, restoreTask } from '../../api';
import { useLang } from '../../context/LangContext';

const ASSIGNEE = {
  Paolo: { bg: 'var(--accent)', init: 'P' },
  Lex: { bg: 'var(--sage)', init: 'L' },
  Rick: { bg: 'var(--amber)', init: 'R' },
  Ray: { bg: 'var(--blue)', init: 'Ra' },
  Boy: { bg: 'var(--purple)', init: 'B' },
};

const REASON_TKEY = {
  delivered: 'archiveReasonDelivered',
  completed: 'archiveReasonCompleted',
  manual: 'archiveReasonManual',
};

function archiveReasonLabel(t, reasonKey) {
  const key = REASON_TKEY[reasonKey] || REASON_TKEY.completed;
  return t(key);
}

const REASON_CLASS = {
  delivered: 'ar-delivered',
  completed: 'ar-completed',
  manual: 'ar-cancelled',
};

function monthKey(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

function formatMonthLabel(key, locale) {
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'nl-NL', { month: 'long', year: 'numeric' });
}

function dateLocale(lang) {
  return lang === 'en' ? 'en-US' : 'nl-NL';
}

function normalizeClientName(value) {
  return String(value ?? '').trim().toLowerCase();
}

/** Match tasks to a client row: by id first, then by display name (legacy tasks often lack clientId). */
function taskMatchesClient(task, clientRow) {
  if (clientRow == null || clientRow.id == null) return true;
  if (task.clientId != null && String(task.clientId) === String(clientRow.id)) return true;
  const rowName = normalizeClientName(clientRow.name);
  if (!rowName) return false;
  return normalizeClientName(task.client) === rowName;
}

const ArchiefView = () => {
  const { t, lang } = useLang();
  const [folder, setFolder] = useState(null);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [reason, setReason] = useState('all');
  const [sort, setSort] = useState('newest');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: getClients });
  const { data: allArchivedTasks = [] } = useQuery({
    queryKey: ['archivedTasks'],
    queryFn: () => getArchivedTasks(),
  });

  const folderTasks = useMemo(() => {
    if (folder == null) return allArchivedTasks;
    const client = clients.find((c) => String(c._id) === String(folder));
    const row = client ? { id: client._id, name: client.name } : { id: folder, name: null };
    return allArchivedTasks.filter((t) => taskMatchesClient(t, row));
  }, [allArchivedTasks, folder, clients]);

  const tasks = folderTasks;
  const restoreMut = useMutation({
    mutationFn: restoreTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archivedTasks'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setModal(null);
      setToast(t('taskRestoredToast'));
      setTimeout(() => setToast(null), 1800);
    },
  });

  const clientNameById = useMemo(
    () =>
      clients.reduce((acc, client) => {
        acc[String(client._id)] = client.name;
        return acc;
      }, {}),
    [clients],
  );
  const monthOptions = useMemo(() => {
    const keys = [...new Set(tasks.map((t) => monthKey(t.archivedAt || t.updatedAt || t.dueDate)).filter(Boolean))];
    return keys.sort((a, b) => (a < b ? 1 : -1));
  }, [tasks]);
  const assigneeOptions = useMemo(() => [...new Set(tasks.map((t) => t.assignee).filter(Boolean))], [tasks]);

  let filtered = [...tasks];

  if (month !== 'all') {
    filtered = filtered.filter((t) => monthKey(t.archivedAt || t.updatedAt || t.dueDate) === month);
  }
  if (assignee !== 'all') {
    filtered = filtered.filter((t) => t.assignee === assignee);
  }
  if (reason !== 'all') {
    filtered = filtered.filter((t) => (t.archivedReason || 'manual') === reason);
  }

  const q = search.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          (clientNameById[String(t.clientId)] || t.client || '').toLowerCase().includes(q) ||
          t.assignee?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q),
      );
  }

  if (sort === 'newest') {
    filtered.sort((a, b) => new Date(b.archivedAt || b.updatedAt || 0) - new Date(a.archivedAt || a.updatedAt || 0));
  } else if (sort === 'oldest') {
    filtered.sort((a, b) => new Date(a.archivedAt || a.updatedAt || 0) - new Date(b.archivedAt || b.updatedAt || 0));
  } else if (sort === 'az') {
    filtered.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  } else if (sort === 'za') {
    filtered.sort((a, b) => String(b.title || '').localeCompare(String(a.title || '')));
  }

  const totalInFolder = tasks.length;
  const activeFilters = [month !== 'all', assignee !== 'all', reason !== 'all', Boolean(q)].filter(Boolean).length;
  const resetFilters = () => {
    setMonth('all');
    setAssignee('all');
    setReason('all');
    setSort('newest');
    setSearch('');
  };

  return (
    <section className="view active">
      <div className="page-header">
        <div>
          <div className="page-title">
            {t('archivePageTitle')} <em>{t('archivePageTitleEm')}</em>
          </div>
          <div className="page-subtitle">
            {tasks.length} {t('archiveArchivedTasksSuffix')}
          </div>
        </div>
      </div>

      <div className="archive-layout">
        <div className="folder-list">
          {[{ name: t('archiveAllTasks'), id: null }, ...clients.map((c) => ({ name: c.name, id: c._id }))].map((f) => (
            <div key={f.name} onClick={() => setFolder(f.id)} className={`folder-item${folder === f.id ? ' active' : ''}`}>
              <span className="folder-icon">{f.id ? '📂' : '📁'}</span> {f.name}
              <span className="folder-count">
                {f.id != null
                  ? allArchivedTasks.filter((task) => taskMatchesClient(task, f)).length
                  : allArchivedTasks.length}
              </span>
            </div>
          ))}
        </div>

        <div className="archive-main">
          <div className="archive-controls-wrap">
            <div className="archive-controls">
              <input
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('archiveSearchPlaceholder')}
                style={{ maxWidth: '200px', flex: 1, minWidth: '140px' }}
              />
              <div className="archive-control-group">
                <span className="archive-control-label">{t('archiveMonth')}</span>
                <select className="form-select archive-select" value={month} onChange={(e) => setMonth(e.target.value)}>
                  <option value="all">{t('archiveAllMonths')}</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{formatMonthLabel(m, lang)}</option>
                  ))}
                </select>
              </div>
              <div className="archive-control-group">
                <span className="archive-control-label">{t('archivePerson')}</span>
                <select className="form-select archive-select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="all">{t('archiveEveryone')}</option>
                  {assigneeOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="archive-control-group">
                <span className="archive-control-label">{t('archiveFilterReason')}</span>
                <select className="form-select archive-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="all">{t('archiveAll')}</option>
                  <option value="completed">{t('archiveReasonCompleted')}</option>
                  <option value="delivered">{t('archiveReasonDelivered')}</option>
                  <option value="manual">{t('archiveReasonManual')}</option>
                </select>
              </div>
              <div className="archive-control-group archive-sort-group">
                <span className="archive-control-label">{t('archiveSort')}</span>
                <select className="form-select archive-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="newest">{t('archiveSortNewest')}</option>
                  <option value="oldest">{t('archiveSortOldest')}</option>
                  <option value="az">{t('archiveSortAZ')}</option>
                  <option value="za">{t('archiveSortZA')}</option>
                </select>
              </div>
              <button type="button" className="btn btn-ghost btn-sm archive-reset-btn" onClick={() => { setFolder(null); resetFilters(); }}>{t('archiveReset')}</button>
            </div>
          </div>

          <div className="archive-content">
          <div className="archive-header">
            <div className="archive-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3>{folder ? clientNameById[String(folder)] || t('archiveClientFallback') : t('archiveAllTasks')}</h3>
              {activeFilters > 0 && (
                <span style={{ fontSize: '11px', background: 'var(--accent-pale)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '20px', fontWeight: '500' }}>
                  {activeFilters === 1
                    ? t('archiveActiveFilterSingular')
                    : t('archiveActiveFilterPlural').replaceAll('{n}', String(activeFilters))}
                </span>
              )}
            </div>
            <span className="archive-header-count" style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              {filtered.length} {t('archiveOf')} {totalInFolder} {t('archiveTaskWord')}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '42px', textAlign: 'center', color: 'var(--text-3)' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🗂</div>
              <div style={{ fontStyle: 'italic', marginBottom: '12px' }}>{t('archiveEmpty')}</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>{t('archiveClearFilters')}</button>
            </div>
          ) : (
            filtered.map((task) => {
              const assigneeMeta = ASSIGNEE[task.assignee] || { bg: '#999', init: task.assignee?.[0] || '?' };
              const reasonKey = task.archivedReason || 'manual';
              const clientName = clientNameById[String(task.clientId)] || task.client || '—';
              return (
                <div key={task._id} className="archived-task" onClick={() => setModal(task)} style={{ cursor: 'pointer' }}>
                  <div className="check-icon">✓</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="archived-title">{task.title}</div>
                    <div className="archived-meta">
                      <span>{clientName}</span>
                      <span>{task.archivedAt ? new Date(task.archivedAt).toLocaleDateString(dateLocale(lang)) : '—'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="task-avatar" style={{ background: assigneeMeta.bg, width: '14px', height: '14px', fontSize: '7px' }}>{assigneeMeta.init}</span>
                        {task.assignee || '—'}
                      </span>
                    </div>
                  </div>
                  <div className="archived-task-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`archive-reason-tag ${REASON_CLASS[reasonKey] || 'ar-completed'}`}>{archiveReasonLabel(t, reasonKey)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>→</span>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay open" onClick={() => setModal(null)}>
          <div className="modal archive-modal" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">{modal.title}</div><button className="modal-close" onClick={() => setModal(null)}>✕</button></div>
            <div className="modal-body">
              <div className="archive-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  [t('eventClientLabel'), clientNameById[String(modal.clientId)] || modal.client || '—'],
                  [t('archiveModalAssignee'), modal.assignee || '—'],
                  [t('archiveModalArchived'), modal.archivedAt ? new Date(modal.archivedAt).toLocaleDateString(dateLocale(lang)) : '—'],
                  [t('archiveModalReason'), archiveReasonLabel(t, modal.archivedReason || 'manual')],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'var(--bg-alt)', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '3px' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{value}</div>
                  </div>
                ))}
              </div>

              {modal.description ? (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>{t('archiveModalDescription')}</div>
                  <div style={{ background: 'var(--bg-alt)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6' }}>
                    {modal.description}
                  </div>
                </div>
              ) : null}

              {modal.checklist?.length ? (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
                    {t('archiveModalChecklist')} ({modal.checklist.filter((x) => x.done).length}/{modal.checklist.length})
                  </div>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {modal.checklist.map((item, idx) => (
                      <div key={`${item.text}-${idx}`} style={{ background: 'var(--bg-alt)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: item.done ? 'var(--text-3)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>
                        {item.done ? '✓ ' : '○ '}{item.text}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--sage)', marginRight: 'auto' }} onClick={() => restoreMut.mutate(modal._id)}>{t('archiveRestoreToTodo')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>{t('close')}</button>
            </div>
          </div>
        </div>
      )}
      {toast ? (
        <div
          className="archive-toast"
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
    </section>
  );
}
export default ArchiefView;

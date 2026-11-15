/**
 * UI Controller — Brave Bookmark Architect
 * Controla:
 * - Listagem, busca e filtros por categoria e status de validade
 * - Disparo de varredura de links e organização na Barra de Favoritos
 * - Popover de prévia ao passar o mouse (hover / focus) com busca sob demanda caso ainda não testado
 * - Modal de edição de notas de observação e categoria (com light-dismiss declarativo + fallback)
 * - Exportação e Importação de Backup JSON (ou arquivo `Bookmarks` nativo do Brave/Chrome)
 */

import { getAllCategories } from '../shared/categorizer.js';
import { LINK_STATUS } from '../shared/link-checker.js';

// Estado da interface
let allBookmarks = [];
let activeCategory = 'ALL';
let activeStatusFilter = 'all';
let searchQuery = '';
let hoverTimer = null;
let hideTimer = null;

// Elementos DOM
const els = {
  btnScanAll: document.getElementById('btnScanAll'),
  btnOrganizeBar: document.getElementById('btnOrganizeBar'),
  btnExportBackup: document.getElementById('btnExportBackup'),
  btnImportBackup: document.getElementById('btnImportBackup'),
  btnOpenFullTab: document.getElementById('btnOpenFullTab'),
  fileImportInput: document.getElementById('fileImportInput'),
  scanProgressSection: document.getElementById('scanProgressSection'),
  scanProgressLabel: document.getElementById('scanProgressLabel'),
  scanProgressNumbers: document.getElementById('scanProgressNumbers'),
  scanProgressBar: document.getElementById('scanProgressBar'),
  statTotal: document.getElementById('statTotal'),
  statValid: document.getElementById('statValid'),
  statRestricted: document.getElementById('statRestricted'),
  statBroken: document.getElementById('statBroken'),
  statWithNotes: document.getElementById('statWithNotes'),
  searchInput: document.getElementById('searchInput'),
  statusFilterSelect: document.getElementById('statusFilterSelect'),
  chkQuarantineBroken: document.getElementById('chkQuarantineBroken'),
  categoryPills: document.getElementById('categoryPills'),
  bookmarksList: document.getElementById('bookmarksList'),
  emptyState: document.getElementById('emptyState'),
  // Popover de Prévia
  previewPopover: document.getElementById('linkPreviewPopover'),
  previewFavicon: document.getElementById('previewFavicon'),
  previewTitle: document.getElementById('previewTitle'),
  previewDomain: document.getElementById('previewDomain'),
  previewStatusBadge: document.getElementById('previewStatusBadge'),
  previewImageContainer: document.getElementById('previewImageContainer'),
  previewImage: document.getElementById('previewImage'),
  previewDescription: document.getElementById('previewDescription'),
  previewNoteBox: document.getElementById('previewNoteBox'),
  previewNoteText: document.getElementById('previewNoteText'),
  previewUrl: document.getElementById('previewUrl'),
  previewCategoryTag: document.getElementById('previewCategoryTag'),
  previewCheckedAt: document.getElementById('previewCheckedAt'),
  // Modal de Notas
  noteDialog: document.getElementById('noteEditDialog'),
  noteForm: document.getElementById('noteEditForm'),
  btnCloseDialog: document.getElementById('btnCloseDialog'),
  btnCancelDialog: document.getElementById('btnCancelDialog'),
  editBookmarkId: document.getElementById('editBookmarkId'),
  editBookmarkUrl: document.getElementById('editBookmarkUrl'),
  editBookmarkTitle: document.getElementById('editBookmarkTitle'),
  editBookmarkUrlDisplay: document.getElementById('editBookmarkUrlDisplay'),
  editBookmarkCategorySelect: document.getElementById('editBookmarkCategorySelect'),
  editBookmarkCustomCategory: document.getElementById('editBookmarkCustomCategory'),
  editBookmarkNote: document.getElementById('editBookmarkNote'),
  editMoveImmediately: document.getElementById('editMoveImmediately'),
  toast: document.getElementById('toastNotification')
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  setupDialogLightDismissFallback();
  setupHoverPopoverBehavior();
  bindEvents();
  await loadBookmarksFromBackground();
});

/**
 * Fallback obrigatório para `closedby="any"` em navegadores sem suporte nativo a `HTMLDialogElement.prototype.closedBy`
 */
function setupDialogLightDismissFallback() {
  const dialog = els.noteDialog;
  if (!dialog) return;

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;

      if (isDialogContent) return;
      dialog.close();
    });
  }
}

/**
 * Configura persistência e acessibilidade (WCAG 1.4.13) do Popover de prévia:
 * - Hoverable: o usuário pode mover o mouse para dentro do popover sem que ele feche
 * - Dismissible: tecla Escape fecha imediatamente
 */
function setupHoverPopoverBehavior() {
  const pop = els.previewPopover;
  if (!pop) return;

  pop.addEventListener('mouseenter', () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });

  pop.addEventListener('mouseleave', () => {
    scheduleHidePreview();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hidePreviewNow();
    }
  });
}

function bindEvents() {
  els.btnScanAll.addEventListener('click', handleScanAll);
  els.btnOrganizeBar.addEventListener('click', handleOrganizeBar);
  els.btnExportBackup.addEventListener('click', handleExportBackup);
  els.btnImportBackup.addEventListener('click', () => els.fileImportInput.click());
  els.fileImportInput.addEventListener('change', handleImportFileSelected);

  els.btnOpenFullTab.addEventListener('click', async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/manager.html') });
  });

  els.searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderBookmarksList();
  });

  els.statusFilterSelect.addEventListener('change', (e) => {
    activeStatusFilter = e.target.value;
    renderBookmarksList();
  });

  // Clique nos cards de estatísticas filtra por status
  document.querySelectorAll('.stat-card').forEach((card) => {
    card.addEventListener('click', () => {
      const status = card.dataset.filterStatus || 'all';
      activeStatusFilter = status;
      els.statusFilterSelect.value = status;
      renderBookmarksList();
    });
  });

  // Modal de edição de notas
  els.btnCloseDialog.addEventListener('click', () => els.noteDialog.close());
  els.btnCancelDialog.addEventListener('click', () => els.noteDialog.close());
  els.noteForm.addEventListener('submit', handleSaveNoteAndCategory);

  // Escuta progresso da varredura enviado pelo Service Worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'SCAN_PROGRESS') {
      const { completed, total, percentage } = msg.payload;
      updateProgressBanner(true, completed, total, percentage);
    } else if (msg?.type === 'SCAN_COMPLETED') {
      updateProgressBanner(false);
      showToast('Varredura de links concluída com sucesso!');
      loadBookmarksFromBackground();
    }
  });
}

async function loadBookmarksFromBackground() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' });
  if (!response?.ok) {
    showToast(`Erro ao carregar favoritos: ${response?.error || 'Desconhecido'}`);
    return;
  }

  allBookmarks = response.bookmarks || [];

  if (response.scanState?.status === 'scanning') {
    const { completed = 0, total = 1 } = response.scanState;
    const pct = Math.round((completed / Math.max(1, total)) * 100);
    updateProgressBanner(true, completed, total, pct);
  } else {
    updateProgressBanner(false);
  }

  updateStats();
  renderCategoryPills();
  renderBookmarksList();
}

function updateProgressBanner(visible, completed = 0, total = 0, percentage = 0) {
  if (!visible) {
    els.scanProgressSection.hidden = true;
    els.btnScanAll.disabled = false;
    return;
  }
  els.scanProgressSection.hidden = false;
  els.btnScanAll.disabled = true;
  els.scanProgressLabel.textContent = 'Testando validade dos links e extraindo prévias...';
  els.scanProgressNumbers.textContent = `${completed} / ${total} (${percentage}%)`;
  els.scanProgressBar.style.width = `${percentage}%`;
}

function updateStats() {
  const total = allBookmarks.length;
  let valid = 0;
  let restricted = 0;
  let broken = 0;
  let withNotes = 0;

  for (const b of allBookmarks) {
    if (b.status === LINK_STATUS.VALID || b.status === LINK_STATUS.SPECIAL) valid++;
    else if (b.status === LINK_STATUS.RESTRICTED) restricted++;
    else if (b.status === LINK_STATUS.BROKEN) broken++;

    if (b.note && b.note.trim().length > 0) withNotes++;
  }

  els.statTotal.textContent = String(total);
  els.statValid.textContent = String(valid);
  els.statRestricted.textContent = String(restricted);
  els.statBroken.textContent = String(broken);
  els.statWithNotes.textContent = String(withNotes);
}

function renderCategoryPills() {
  const counts = new Map();
  for (const b of allBookmarks) {
    const cat = b.category || 'Geral';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }

  els.categoryPills.replaceChildren();

  const allPill = document.createElement('button');
  allPill.type = 'button';
  allPill.className = `category-pill ${activeCategory === 'ALL' ? 'active' : ''}`;
  allPill.textContent = `Todas (${allBookmarks.length})`;
  allPill.addEventListener('click', () => {
    activeCategory = 'ALL';
    renderCategoryPills();
    renderBookmarksList();
  });
  els.categoryPills.appendChild(allPill);

  const sortedCategories = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCategories) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `category-pill ${activeCategory === cat ? 'active' : ''}`;
    btn.textContent = `${cat} (${count})`;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      renderCategoryPills();
      renderBookmarksList();
    });
    els.categoryPills.appendChild(btn);
  }
}

function getFilteredBookmarks() {
  return allBookmarks.filter((b) => {
    if (activeCategory !== 'ALL' && b.category !== activeCategory) {
      return false;
    }

    if (activeStatusFilter === 'valid') {
      if (b.status !== LINK_STATUS.VALID && b.status !== LINK_STATUS.SPECIAL) return false;
    } else if (activeStatusFilter === 'restricted') {
      if (b.status !== LINK_STATUS.RESTRICTED) return false;
    } else if (activeStatusFilter === 'broken') {
      if (b.status !== LINK_STATUS.BROKEN) return false;
    } else if (activeStatusFilter === 'unchecked') {
      if (b.status && b.status !== LINK_STATUS.UNCHECKED) return false;
    } else if (activeStatusFilter === 'with_notes') {
      if (!b.note || !b.note.trim()) return false;
    }

    if (searchQuery) {
      const hay = `${b.title || ''} ${b.url || ''} ${b.note || ''} ${b.category || ''}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }

    return true;
  });
}

function renderBookmarksList() {
  const filtered = getFilteredBookmarks();
  els.bookmarksList.replaceChildren();

  if (filtered.length === 0) {
    els.emptyState.hidden = false;
    return;
  }
  els.emptyState.hidden = true;

  const fragment = document.createDocumentFragment();
  for (const bm of filtered) {
    fragment.appendChild(createBookmarkCard(bm));
  }
  els.bookmarksList.appendChild(fragment);
}

function getFaviconUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32`;
    }
  } catch {
    // ignore
  }
  return '../../icons/icon-16.png';
}

function getStatusBadgeInfo(bm) {
  switch (bm.status) {
    case LINK_STATUS.VALID:
      return { label: `OK ${bm.statusCode || 200}`, cls: 'status-valid' };
    case LINK_STATUS.RESTRICTED:
      return { label: `Protegido ${bm.statusCode || ''}`.trim(), cls: 'status-restricted' };
    case LINK_STATUS.BROKEN:
      return { label: bm.statusCode ? `Erro ${bm.statusCode}` : 'Offline', cls: 'status-broken' };
    case LINK_STATUS.SPECIAL:
      return { label: 'Local / Script', cls: 'status-special' };
    default:
      return { label: 'Não testado', cls: 'status-unchecked' };
  }
}

function createBookmarkCard(bm) {
  const card = document.createElement('article');
  card.className = 'bookmark-card';
  card.setAttribute('role', 'listitem');

  const top = document.createElement('div');
  top.className = 'card-top';

  const link = document.createElement('a');
  link.className = 'bookmark-link';
  link.href = bm.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('interestfor', 'linkPreviewPopover');

  const favicon = document.createElement('img');
  favicon.className = 'bookmark-favicon';
  favicon.src = getFaviconUrl(bm.url);
  favicon.alt = '';
  favicon.loading = 'lazy';
  favicon.addEventListener('error', () => {
    favicon.src = '../../icons/icon-16.png';
  });

  const titleSpan = document.createElement('span');
  titleSpan.textContent = bm.title || bm.url;

  link.append(favicon, titleSpan);

  // Eventos de hover e foco para exibir a prévia rica
  link.addEventListener('mouseenter', () => scheduleShowPreview(bm, link));
  link.addEventListener('mouseleave', () => scheduleHidePreview());
  link.addEventListener('focus', () => scheduleShowPreview(bm, link));
  link.addEventListener('blur', () => scheduleHidePreview());

  top.appendChild(link);

  const urlLine = document.createElement('div');
  urlLine.className = 'card-url';
  urlLine.textContent = bm.url;

  card.append(top, urlLine);

  if (bm.note && bm.note.trim()) {
    const noteDiv = document.createElement('div');
    noteDiv.className = 'card-note';
    noteDiv.textContent = `📝 ${bm.note}`;
    card.appendChild(noteDiv);
  }

  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const badgesWrap = document.createElement('div');
  badgesWrap.className = 'badges-wrap';

  const catBadge = document.createElement('span');
  catBadge.className = 'category-tag';
  catBadge.textContent = `📁 ${bm.category || 'Geral'}`;

  const statusInfo = getStatusBadgeInfo(bm);
  const statusBadge = document.createElement('span');
  statusBadge.className = `status-badge ${statusInfo.cls}`;
  statusBadge.textContent = statusInfo.label;
  if (bm.error) statusBadge.title = bm.error;

  badgesWrap.append(catBadge, statusBadge);

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const btnCheck = document.createElement('button');
  btnCheck.type = 'button';
  btnCheck.className = 'action-btn';
  btnCheck.title = 'Testar este link agora e atualizar prévia';
  btnCheck.textContent = '🔄';
  btnCheck.addEventListener('click', () => handleCheckSingle(bm, btnCheck));

  const btnNote = document.createElement('button');
  btnNote.type = 'button';
  btnNote.className = 'action-btn';
  btnNote.title = 'Adicionar / Editar Nota de Observação e Categoria';
  btnNote.textContent = bm.note ? '📝 Nota' : '+ Nota';
  btnNote.addEventListener('click', () => openNoteDialog(bm));

  const btnDelete = document.createElement('button');
  btnDelete.type = 'button';
  btnDelete.className = 'action-btn';
  btnDelete.title = 'Remover favorito';
  btnDelete.textContent = '🗑️';
  btnDelete.addEventListener('click', () => handleDeleteBookmark(bm));

  actions.append(btnCheck, btnNote, btnDelete);
  footer.append(badgesWrap, actions);
  card.appendChild(footer);

  return card;
}

/**
 * Agenda abertura do Popover de prévia ao passar o mouse sobre o link
 */
function scheduleShowPreview(bm, anchorEl) {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (hoverTimer) {
    clearTimeout(hoverTimer);
  }

  hoverTimer = setTimeout(async () => {
    populatePreviewPopover(bm, anchorEl);
    showPreviewPopover(anchorEl);

    // Se ainda não tiver prévia nem foi testado, busca sob demanda em tempo real!
    if (!bm.preview && (!bm.status || bm.status === LINK_STATUS.UNCHECKED)) {
      els.previewDescription.textContent = 'Carregando prévia ao vivo do link...';
      const resp = await chrome.runtime.sendMessage({
        type: 'CHECK_SINGLE_LINK',
        payload: { url: bm.url, category: bm.category }
      });
      if (resp?.ok && resp.result) {
        Object.assign(bm, resp.result);
        populatePreviewPopover(bm, anchorEl);
        updateStats();
      }
    }
  }, 220);
}

function scheduleHidePreview() {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  hideTimer = setTimeout(() => {
    hidePreviewNow();
  }, 240);
}

function hidePreviewNow() {
  try {
    if (els.previewPopover.matches(':popover-open')) {
      els.previewPopover.hidePopover();
    } else {
      els.previewPopover.style.display = 'none';
    }
  } catch {
    els.previewPopover.style.display = 'none';
  }
}

function showPreviewPopover(anchorEl) {
  const pop = els.previewPopover;
  try {
    if (!pop.matches(':popover-open')) {
      pop.showPopover();
    }
  } catch {
    pop.style.display = 'flex';
  }

  // Posiciona o popover próximo ao link garantindo que não saia da janela
  const rect = anchorEl.getBoundingClientRect();
  const popWidth = 350;
  const popHeight = pop.offsetHeight || 220;

  let top = rect.bottom + 8;
  if (top + popHeight > window.innerHeight - 12) {
    top = Math.max(12, rect.top - popHeight - 8);
  }

  let left = rect.left;
  if (left + popWidth > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - popWidth - 12);
  }

  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
}

function populatePreviewPopover(bm) {
  els.previewFavicon.src = getFaviconUrl(bm.url);
  els.previewTitle.textContent = bm.preview?.pageTitle || bm.title || 'Sem título';

  try {
    els.previewDomain.textContent = new URL(bm.url).hostname;
  } catch {
    els.previewDomain.textContent = 'Recurso local / script';
  }

  const statusInfo = getStatusBadgeInfo(bm);
  els.previewStatusBadge.className = `status-badge ${statusInfo.cls}`;
  els.previewStatusBadge.textContent = statusInfo.label;

  if (bm.preview?.image) {
    els.previewImageContainer.hidden = false;
    els.previewImage.src = bm.preview.image;
    els.previewImage.onerror = () => {
      els.previewImageContainer.hidden = true;
    };
  } else {
    els.previewImageContainer.hidden = true;
    els.previewImage.src = '';
  }

  if (bm.preview?.description) {
    els.previewDescription.textContent = bm.preview.description;
  } else if (bm.error) {
    els.previewDescription.textContent = `⚠️ Diagnóstico: ${bm.error}`;
  } else {
    els.previewDescription.textContent = 'Passe o mouse ou clique em 🔄 para inspecionar os metadados deste link.';
  }

  if (bm.note && bm.note.trim()) {
    els.previewNoteBox.hidden = false;
    els.previewNoteText.textContent = bm.note;
  } else {
    els.previewNoteBox.hidden = true;
  }

  els.previewUrl.textContent = bm.url.slice(0, 110) + (bm.url.length > 110 ? '...' : '');
  els.previewCategoryTag.textContent = `📁 ${bm.category || 'Geral'}`;
  els.previewCheckedAt.textContent = bm.checkedAt
    ? `Verificado: ${new Date(bm.checkedAt).toLocaleString('pt-BR')}`
    : 'Ainda não verificado';
}

/**
 * Testa um único link manualmente
 */
async function handleCheckSingle(bm, btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = '⏳';
  const resp = await chrome.runtime.sendMessage({
    type: 'CHECK_SINGLE_LINK',
    payload: { url: bm.url, category: bm.category }
  });
  btnEl.disabled = false;
  btnEl.textContent = '🔄';

  if (resp?.ok && resp.result) {
    Object.assign(bm, resp.result);
    updateStats();
    renderBookmarksList();
    showToast(`Link verificado: ${getStatusBadgeInfo(bm).label}`);
  }
}

/**
 * Dispara a varredura de todos os links
 */
async function handleScanAll() {
  els.btnScanAll.disabled = true;
  updateProgressBanner(true, 0, allBookmarks.length, 0);
  await chrome.runtime.sendMessage({
    type: 'SCAN_ALL_LINKS',
    payload: { onlyUnchecked: false }
  });
}

/**
 * Organiza todos os links em pastas de categorias na Barra de Favoritos
 */
async function handleOrganizeBar() {
  els.btnOrganizeBar.disabled = true;
  const quarantineBroken = els.chkQuarantineBroken.checked;

  const resp = await chrome.runtime.sendMessage({
    type: 'ORGANIZE_BOOKMARKS',
    payload: {
      quarantineBroken,
      removeEmptyFolders: true
    }
  });
  els.btnOrganizeBar.disabled = false;

  if (resp?.ok && resp.result) {
    const { movedCount, categoriesUsed } = resp.result;
    showToast(`✅ ${movedCount} favoritos organizados em ${categoriesUsed} pastas na Barra de Favoritos!`);
    await loadBookmarksFromBackground();
  } else {
    showToast(`Erro ao organizar: ${resp?.error || 'Desconhecido'}`);
  }
}

/**
 * Abre o modal de edição de Nota de Observação e Categoria
 */
function openNoteDialog(bm) {
  hidePreviewNow();
  els.editBookmarkId.value = bm.id || '';
  els.editBookmarkUrl.value = bm.url;
  els.editBookmarkTitle.value = bm.title || '';
  els.editBookmarkUrlDisplay.value = bm.url;
  els.editBookmarkNote.value = bm.note || '';
  els.editBookmarkCustomCategory.value = '';

  // Popula select de categorias
  const knownCategories = new Set(getAllCategories());
  for (const item of allBookmarks) {
    if (item.category) knownCategories.add(item.category);
  }

  els.editBookmarkCategorySelect.replaceChildren();
  for (const cat of knownCategories) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === bm.category) opt.selected = true;
    els.editBookmarkCategorySelect.appendChild(opt);
  }

  els.noteDialog.showModal();
  els.editBookmarkNote.focus();
}

/**
 * Salva nota de observação e categoria do favorito
 */
async function handleSaveNoteAndCategory(e) {
  e.preventDefault();
  const bookmarkId = els.editBookmarkId.value;
  const url = els.editBookmarkUrl.value;
  const title = els.editBookmarkTitle.value.trim();
  const customCat = els.editBookmarkCustomCategory.value.trim();
  const category = customCat || els.editBookmarkCategorySelect.value || 'Geral';
  const note = els.editBookmarkNote.value.trim();
  const moveNow = els.editMoveImmediately.checked;

  const resp = await chrome.runtime.sendMessage({
    type: 'SAVE_NOTE_AND_CATEGORY',
    payload: { bookmarkId, url, title, note, category, moveNow }
  });

  els.noteDialog.close();

  if (resp?.ok) {
    showToast('💾 Nota e categoria salvas com sucesso!');
    await loadBookmarksFromBackground();
  } else {
    showToast(`Erro ao salvar: ${resp?.error || 'Desconhecido'}`);
  }
}

/**
 * Remove um favorito
 */
async function handleDeleteBookmark(bm) {
  if (!bm.id) return;
  const resp = await chrome.runtime.sendMessage({
    type: 'DELETE_BOOKMARK',
    payload: { bookmarkId: bm.id }
  });
  if (resp?.ok) {
    showToast('🗑️ Favorito removido.');
    await loadBookmarksFromBackground();
  }
}

/**
 * Exporta todos os favoritos, categorias, status e notas para um arquivo JSON de backup
 */
async function handleExportBackup() {
  const resp = await chrome.runtime.sendMessage({ type: 'EXPORT_BACKUP' });
  if (!resp?.ok || !resp.backup) {
    showToast('Erro ao gerar backup.');
    return;
  }

  const jsonString = JSON.stringify(resp.backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bookmarks-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast('⬇️ Backup exportado com sucesso!');
}

/**
 * Importa um arquivo JSON de backup (ou o arquivo `Bookmarks` nativo do Brave/Chrome)
 */
async function handleImportFileSelected(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const resp = await chrome.runtime.sendMessage({
      type: 'IMPORT_BACKUP',
      payload: { jsonContent: text }
    });

    if (resp?.ok && resp.result) {
      const { createdCount, updatedCount, totalInFile } = resp.result;
      showToast(
        `⬆️ Importado! ${totalInFile} lidos (${createdCount} novos criados, ${updatedCount} atualizados na Barra).`
      );
      await loadBookmarksFromBackground();
    } else {
      showToast(`Erro na importação: ${resp?.error || 'Formato inválido'}`);
    }
  } catch (err) {
    showToast(`Falha ao ler arquivo: ${err.message}`);
  }
}

let toastTimer = null;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 4000);
}


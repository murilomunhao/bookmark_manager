/**
 * UI Controller — Brave Bookmark Architect
 * Controls:
 * - Multi-language support (English default, Português Brasil, Español)
 * - Listing, search and filtering by category and link validity status
 * - Triggering link scan and Bookmarks Bar organization
 * - Hover / focus preview popover with live on-demand inspection
 * - Bookmark Edit Modal (Name, Link/URL with broken-link guard, Observation Note and Category)
 * - Backup JSON Export & Import (including native Brave/Chrome `Bookmarks` file)
 */

import { extractDomainNameUppercase, getAllCategories } from '../shared/categorizer.js';
import { LINK_STATUS } from '../shared/link-checker.js';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, t } from '../shared/i18n.js';
import { getSavedLanguage, setSavedLanguage } from '../shared/storage-service.js';

// UI State
let allBookmarks = [];
let activeCategory = 'ALL';
let activeStatusFilter = 'all';
let searchQuery = '';
let currentLang = DEFAULT_LOCALE;
let hoverTimer = null;
let hideTimer = null;

// DOM Elements
const els = {
  btnScanAll: document.getElementById('btnScanAll'),
  btnOrganizeBar: document.getElementById('btnOrganizeBar'),
  btnExportBackup: document.getElementById('btnExportBackup'),
  btnImportBackup: document.getElementById('btnImportBackup'),
  btnOpenFullTab: document.getElementById('btnOpenFullTab'),
  languageSelect: document.getElementById('languageSelect'),
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
  // Preview Popover
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
  // Edit Modal
  noteDialog: document.getElementById('noteEditDialog'),
  noteForm: document.getElementById('noteEditForm'),
  btnCloseDialog: document.getElementById('btnCloseDialog'),
  btnCancelDialog: document.getElementById('btnCancelDialog'),
  editBookmarkId: document.getElementById('editBookmarkId'),
  editBookmarkUrl: document.getElementById('editBookmarkUrl'),
  editBookmarkTitle: document.getElementById('editBookmarkTitle'),
  btnUseDomainName: document.getElementById('btnUseDomainName'),
  editBookmarkUrlDisplay: document.getElementById('editBookmarkUrlDisplay'),
  editBookmarkCategorySelect: document.getElementById('editBookmarkCategorySelect'),
  editBookmarkCustomCategory: document.getElementById('editBookmarkCustomCategory'),
  editBookmarkNote: document.getElementById('editBookmarkNote'),
  editMoveImmediately: document.getElementById('editMoveImmediately'),
  editValidationError: document.getElementById('editValidationError'),
  btnSaveNote: document.getElementById('btnSaveNote'),
  toast: document.getElementById('toastNotification')
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  setupDialogLightDismissFallback();
  setupHoverPopoverBehavior();
  await initLanguage();
  bindEvents();
  await loadBookmarksFromBackground();
});

async function initLanguage() {
  const saved = await getSavedLanguage();
  currentLang = SUPPORTED_LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;
  if (els.languageSelect) {
    els.languageSelect.value = currentLang;
  }
  applyStaticTranslations();
}

/**
 * Applies translations to all static DOM elements carrying `data-i18n*` attributes
 */
function applyStaticTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(currentLang, key);
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(currentLang, key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(currentLang, key);
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) el.setAttribute('aria-label', t(currentLang, key));
  });
}

/**
 * Mandatory fallback for `closedby="any"` in browsers lacking native `HTMLDialogElement.prototype.closedBy`
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
 * Configures WCAG 1.4.13 compliance for the preview popover:
 * - Hoverable: pointer can move inside the popover without dismissing it
 * - Dismissible: Escape key closes it immediately
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

  if (els.languageSelect) {
    els.languageSelect.addEventListener('change', async (e) => {
      const selected = e.target.value;
      if (SUPPORTED_LOCALES.includes(selected)) {
        currentLang = selected;
        await setSavedLanguage(currentLang);
        applyStaticTranslations();
        renderCategoryPills();
        renderBookmarksList();
      }
    });
  }

  els.searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderBookmarksList();
  });

  els.statusFilterSelect.addEventListener('change', (e) => {
    activeStatusFilter = e.target.value;
    renderBookmarksList();
  });

  // Stat cards filter by status on click
  document.querySelectorAll('.stat-card').forEach((card) => {
    card.addEventListener('click', () => {
      const status = card.dataset.filterStatus || 'all';
      activeStatusFilter = status;
      els.statusFilterSelect.value = status;
      renderBookmarksList();
    });
  });

  // Edit modal events
  els.btnCloseDialog.addEventListener('click', () => els.noteDialog.close());
  els.btnCancelDialog.addEventListener('click', () => els.noteDialog.close());
  els.noteForm.addEventListener('submit', handleSaveNoteAndCategory);

  if (els.btnUseDomainName) {
    els.btnUseDomainName.addEventListener('click', () => {
      const currentUrl = els.editBookmarkUrlDisplay.value.trim();
      els.editBookmarkTitle.value = extractDomainNameUppercase(currentUrl);
    });
  }

  // Listen for scan progress from Service Worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'SCAN_PROGRESS') {
      const { completed, total, percentage } = msg.payload;
      updateProgressBanner(true, completed, total, percentage);
    } else if (msg?.type === 'SCAN_COMPLETED') {
      updateProgressBanner(false);
      showToast(t(currentLang, 'toastScanCompleted'));
      loadBookmarksFromBackground();
    }
  });
}

async function loadBookmarksFromBackground() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' });
  if (!response?.ok) {
    showToast(`${t(currentLang, 'toastLoadError')} ${response?.error || ''}`);
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
  els.scanProgressLabel.textContent = t(currentLang, 'scanProgressLabel');
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
  allPill.textContent = `${t(currentLang, 'pillAll')} (${allBookmarks.length})`;
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
      const hay = `${b.title || ''} ${b.originalTitle || ''} ${b.url || ''} ${b.note || ''} ${b.category || ''}`.toLowerCase();
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
      return { label: `${t(currentLang, 'badgeValid')} ${bm.statusCode || 200}`, cls: 'status-valid' };
    case LINK_STATUS.RESTRICTED:
      return { label: `${t(currentLang, 'badgeRestricted')} ${bm.statusCode || ''}`.trim(), cls: 'status-restricted' };
    case LINK_STATUS.BROKEN:
      return {
        label: bm.statusCode
          ? `${t(currentLang, 'badgeBrokenError')} ${bm.statusCode}`
          : t(currentLang, 'badgeBrokenOffline'),
        cls: 'status-broken'
      };
    case LINK_STATUS.SPECIAL:
      return { label: t(currentLang, 'badgeSpecial'), cls: 'status-special' };
    default:
      return { label: t(currentLang, 'badgeUnchecked'), cls: 'status-unchecked' };
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

  // Hover & focus events to display rich preview
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
  btnCheck.title = t(currentLang, 'btnCheckSingleTitle');
  btnCheck.textContent = '🔄';
  btnCheck.addEventListener('click', () => handleCheckSingle(bm, btnCheck));

  const btnNote = document.createElement('button');
  btnNote.type = 'button';
  btnNote.className = 'action-btn';
  btnNote.title = t(currentLang, 'btnEditTitle');
  btnNote.textContent = bm.note ? t(currentLang, 'btnEditWithNoteLabel') : t(currentLang, 'btnEditLabel');
  btnNote.addEventListener('click', () => openNoteDialog(bm));

  const btnDelete = document.createElement('button');
  btnDelete.type = 'button';
  btnDelete.className = 'action-btn';
  btnDelete.title = t(currentLang, 'btnDeleteTitle');
  btnDelete.textContent = '🗑️';
  btnDelete.addEventListener('click', () => handleDeleteBookmark(bm));

  actions.append(btnCheck, btnNote, btnDelete);
  footer.append(badgesWrap, actions);
  card.appendChild(footer);

  return card;
}

/**
 * Schedules opening the preview popover on link hover
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

    // Live on-demand fetch if not checked yet
    if (!bm.preview && (!bm.status || bm.status === LINK_STATUS.UNCHECKED)) {
      els.previewDescription.textContent = t(currentLang, 'previewLiveLoading');
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
  els.previewTitle.textContent = bm.preview?.pageTitle || bm.originalTitle || bm.title || t(currentLang, 'previewUntitled');

  try {
    els.previewDomain.textContent = new URL(bm.url).hostname;
  } catch {
    els.previewDomain.textContent = t(currentLang, 'previewLocalResource');
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
    els.previewDescription.textContent = `${t(currentLang, 'previewDiagnosis')} ${bm.error}`;
  } else {
    els.previewDescription.textContent = t(currentLang, 'previewHoverHint');
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
    ? `${t(currentLang, 'previewVerifiedAt')} ${new Date(bm.checkedAt).toLocaleString(currentLang)}`
    : t(currentLang, 'previewNotVerified');
}

/**
 * Manually tests a single bookmark link
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
    showToast(`${t(currentLang, 'toastSingleChecked')} ${getStatusBadgeInfo(bm).label}`);
  }
}

/**
 * Triggers batch link scan
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
 * Organizes all bookmarks into category folders on the Bookmarks Bar
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
    const { movedCount, renamedCount = 0, categoriesUsed } = resp.result;
    showToast(
      t(currentLang, 'toastOrganized', {
        moved: movedCount,
        renamed: renamedCount,
        cats: categoriesUsed
      })
    );
    await loadBookmarksFromBackground();
  } else {
    showToast(`${t(currentLang, 'toastOrganizeError')} ${resp?.error || ''}`);
  }
}

/**
 * Opens the Bookmark Edit Modal
 */
function openNoteDialog(bm) {
  hidePreviewNow();
  if (els.editValidationError) {
    els.editValidationError.hidden = true;
    els.editValidationError.textContent = '';
  }
  els.editBookmarkId.value = bm.id || '';
  els.editBookmarkUrl.value = bm.url;
  els.editBookmarkTitle.value = bm.title || '';
  els.editBookmarkUrlDisplay.value = bm.url;
  els.editBookmarkNote.value = bm.note || '';
  els.editBookmarkCustomCategory.value = '';

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
 * Validates the target URL and saves Name, Link (URL), Observation Note and Category.
 * Blocks saving if the link is broken.
 */
async function handleSaveNoteAndCategory(e) {
  e.preventDefault();
  if (els.editValidationError) {
    els.editValidationError.hidden = true;
    els.editValidationError.textContent = '';
  }

  const bookmarkId = els.editBookmarkId.value;
  const oldUrl = els.editBookmarkUrl.value;
  const url = els.editBookmarkUrlDisplay.value.trim();
  const title = els.editBookmarkTitle.value.trim() || extractDomainNameUppercase(url);
  const customCat = els.editBookmarkCustomCategory.value.trim();
  const category = customCat || els.editBookmarkCategorySelect.value || 'Geral';
  const note = els.editBookmarkNote.value.trim();
  const moveNow = els.editMoveImmediately.checked;

  const originalBtnText = t(currentLang, 'btnSave');
  if (els.btnSaveNote) {
    els.btnSaveNote.disabled = true;
    els.btnSaveNote.textContent = t(currentLang, 'btnValidating');
  }

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'SAVE_NOTE_AND_CATEGORY',
      payload: { bookmarkId, oldUrl, url, title, note, category, moveNow }
    });

    if (resp?.ok) {
      els.noteDialog.close();
      showToast(t(currentLang, 'toastSaved'));
      await loadBookmarksFromBackground();
    } else {
      const errMsg = resp?.error || 'Invalid or unreachable URL.';
      if (els.editValidationError) {
        els.editValidationError.textContent = `❌ ${errMsg}`;
        els.editValidationError.hidden = false;
      }
      els.editBookmarkUrlDisplay.focus();
      showToast(`${t(currentLang, 'toastNotSaved')} ${errMsg}`);
    }
  } finally {
    if (els.btnSaveNote) {
      els.btnSaveNote.disabled = false;
      els.btnSaveNote.textContent = originalBtnText;
    }
  }
}

/**
 * Removes a bookmark
 */
async function handleDeleteBookmark(bm) {
  if (!bm.id) return;
  const resp = await chrome.runtime.sendMessage({
    type: 'DELETE_BOOKMARK',
    payload: { bookmarkId: bm.id }
  });
  if (resp?.ok) {
    showToast(t(currentLang, 'toastDeleted'));
    await loadBookmarksFromBackground();
  }
}

/**
 * Exports all bookmarks, categories, status and notes to a JSON backup file
 */
async function handleExportBackup() {
  const resp = await chrome.runtime.sendMessage({ type: 'EXPORT_BACKUP' });
  if (!resp?.ok || !resp.backup) {
    showToast(t(currentLang, 'toastExportError'));
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

  showToast(t(currentLang, 'toastExported'));
}

/**
 * Imports a JSON backup file (or native Brave/Chrome `Bookmarks` file)
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
        t(currentLang, 'toastImported', {
          total: totalInFile,
          created: createdCount,
          updated: updatedCount
        })
      );
      await loadBookmarksFromBackground();
    } else {
      showToast(`${t(currentLang, 'toastImportError')} ${resp?.error || ''}`);
    }
  } catch (err) {
    showToast(`${t(currentLang, 'toastFileReadError')} ${err.message}`);
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

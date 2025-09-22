const screens = Array.from(document.querySelectorAll('.screen'));
const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
const toast = document.querySelector('[data-toast]');

let toastTimer = null;
let selectedFile = null;
let progressTimer = null;
let currentProgress = 0;
let currentWorkflowId = 4938;

const uploadInput = document.querySelector('#upload-input');
const uploadPreview = document.querySelector('[data-upload-preview]');
const uploadName = document.querySelector('[data-upload-name]');
const uploadSize = document.querySelector('[data-upload-size]');
const uploadError = document.querySelector('[data-upload-error]');
const sendButton = document.querySelector('[data-action="send-file"]');
const clearFileButton = document.querySelector('[data-action="clear-file"]');

const progressRing = document.querySelector('[data-progress-ring]');
const progressValue = document.querySelector('[data-progress-value]');
const progressStatus = document.querySelector('[data-progress-status]');
const progressSubtitle = document.querySelector('[data-progress-subtitle]');
const cancelButton = document.querySelector('[data-action="cancel-job"]');

const timelineSteps = {
  upload: document.querySelector('[data-step="upload"]'),
  transcribe: document.querySelector('[data-step="transcribe"]'),
  doc: document.querySelector('[data-step="doc"]'),
};

const resultFile = document.querySelector('[data-result-file]');
const resultDuration = document.querySelector('[data-result-duration]');
const resultNote = document.querySelector('[data-result-note]');
const resultTime = document.querySelector('[data-result-time]');
const resultLink = document.querySelector('[data-result-link]');
const copyButton = document.querySelector('[data-action="copy-text"]');
const dashboardButton = document.querySelector('[data-action="open-dashboard"]');

const lastJobStatus = document.querySelector('[data-last-job-status]');
const lastJobText = document.querySelector('[data-last-job-text]');

const historyLatestTitle = document.querySelector('[data-history-latest-title]');
const historyLatestDate = document.querySelector('[data-history-latest-date]');
const historyLatestStatus = document.querySelector('[data-history-latest-status]');

const transcriptPlaceholder = `NewVision Voice — фрагмент интервью

[00:00] Ведущий приветствует слушателей и объясняет цель выпуска.
[02:34] Гость рассказывает про сценарии использования NewVision Voice.
[06:18] Обсуждаем, как связка Telegram + n8n ускоряет рабочие процессы.
[11:02] Финальные мысли и приглашение протестировать мини-приложение.`;

function showToast(message, variant = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden', 'toast-success', 'toast-warning', 'toast-info');
  const variantClass = {
    success: 'toast-success',
    warning: 'toast-warning',
    info: 'toast-info',
  }[variant] || 'toast-info';
  toast.classList.add(variantClass);

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

if (toast) {
  toast.addEventListener('click', () => {
    toast.classList.add('hidden');
    clearTimeout(toastTimer);
  });
}

function showScreen(targetId) {
  screens.forEach((screen) => {
    screen.classList.toggle('active', screen.id === targetId);
  });

  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === targetId);
  });
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.target;
    if (!target) return;
    showScreen(target);
  });
});

document.querySelectorAll('[data-screen-target]').forEach((trigger) => {
  trigger.addEventListener('click', () => {
    const target = trigger.dataset.screenTarget;
    if (!target) return;
    showScreen(target);
  });
});

function formatFileSize(bytes = 0) {
  if (!bytes) return '';
  const sizeMb = bytes / (1024 * 1024);
  if (sizeMb < 1) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${sizeMb.toFixed(1)} МБ`;
}

function estimateDuration(bytes = 0) {
  if (!bytes) return '10 мин';
  const sizeMb = bytes / (1024 * 1024);
  const minutes = Math.max(2, Math.round(sizeMb * 1.6 + 2));
  return `${minutes} мин`;
}

function formatRelativeDate(date = new Date()) {
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (sameDay) {
    return `Сегодня • ${time}`;
  }
  return `${date.toLocaleDateString('ru-RU')} • ${time}`;
}

function buildDocLink(name = '') {
  const hash = Math.random().toString(36).slice(2, 10);
  const slug = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase() || 'transcript';
  return `https://docs.google.com/document/d/${hash}/edit#${slug}`;
}

function toggleUploadError(visible, message) {
  if (!uploadError) return;
  if (message) {
    uploadError.textContent = message;
  }
  uploadError.classList.toggle('visible', Boolean(visible));
}

function resetUploadState() {
  selectedFile = null;
  if (uploadInput) {
    uploadInput.value = '';
  }
  if (uploadPreview) {
    uploadPreview.classList.add('hidden');
  }
  if (sendButton) {
    sendButton.disabled = true;
  }
  toggleUploadError(false);
}

function updateUploadPreview(file) {
  if (!uploadPreview || !uploadName || !uploadSize) return;
  if (!file) {
    uploadPreview.classList.add('hidden');
    uploadName.textContent = 'Файл не выбран';
    uploadSize.textContent = '';
    return;
  }
  uploadPreview.classList.remove('hidden');
  uploadName.textContent = file.name;
  uploadSize.textContent = formatFileSize(file.size);
}

function setTimelineState(state) {
  Object.values(timelineSteps).forEach((step) => {
    if (!step) return;
    step.classList.remove('done', 'active');
  });

  if (state === 'upload') {
    timelineSteps.upload?.classList.add('active');
  } else if (state === 'transcribe') {
    timelineSteps.upload?.classList.add('done');
    timelineSteps.transcribe?.classList.add('active');
  } else if (state === 'doc') {
    timelineSteps.upload?.classList.add('done');
    timelineSteps.transcribe?.classList.add('done');
    timelineSteps.doc?.classList.add('active');
  } else if (state === 'done') {
    timelineSteps.upload?.classList.add('done');
    timelineSteps.transcribe?.classList.add('done');
    timelineSteps.doc?.classList.add('done');
  }
}

function updateProgress(value) {
  currentProgress = value;
  if (progressRing) {
    progressRing.style.setProperty('--progress-angle', `${Math.min(360, value * 3.6)}deg`);
  }
  if (progressValue) {
    progressValue.textContent = `${Math.round(value)}%`;
  }

  if (!progressStatus) return;

  if (value < 20) {
    progressStatus.textContent = 'Загружаем файл на сервер…';
    setTimelineState('upload');
  } else if (value < 70) {
    progressStatus.textContent = 'Whisper AI распознаёт речь…';
    setTimelineState('transcribe');
  } else if (value < 100) {
    progressStatus.textContent = 'Форматируем расшифровку и создаём документ…';
    setTimelineState('doc');
  } else {
    progressStatus.textContent = 'Готово! Финализируем ссылку…';
    setTimelineState('done');
  }
}

function generateWorkflowId() {
  return Math.floor(3000 + Math.random() * 7000);
}

function updateSummaryCards(snapshot) {
  if (lastJobStatus) {
    lastJobStatus.textContent = 'Готово';
    lastJobStatus.classList.remove('warning', 'muted');
    lastJobStatus.classList.add('success');
  }
  if (lastJobText) {
    const name = snapshot?.name || 'Новый транскрипт';
    lastJobText.textContent = `${name} обработан и доступен в Google Doc.`;
  }

  if (historyLatestTitle) {
    historyLatestTitle.textContent = snapshot?.name?.replace(/\.[^/.]+$/, '') || 'Новый транскрипт';
  }
  if (historyLatestDate) {
    historyLatestDate.textContent = formatRelativeDate();
  }
  if (historyLatestStatus) {
    historyLatestStatus.textContent = 'Готово';
    historyLatestStatus.classList.remove('warning', 'muted');
    historyLatestStatus.classList.add('success');
  }
}

function updateResult(snapshot) {
  if (resultFile) {
    resultFile.textContent = snapshot?.name || 'audio.mp3';
  }
  if (resultDuration) {
    resultDuration.textContent = `Длительность: ~${estimateDuration(snapshot?.size)}`;
  }
  if (resultNote) {
    resultNote.textContent = 'Ссылка отправлена в чат и сохранена в истории mini app.';
  }
  if (resultTime) {
    resultTime.textContent = `Обработано ${formatRelativeDate()}`;
  }
  if (resultLink) {
    resultLink.href = buildDocLink(snapshot?.name);
  }
}

function completeWorkflow() {
  const snapshot = selectedFile
    ? { name: selectedFile.name, size: selectedFile.size }
    : { name: 'Transcription.mp3', size: 0 };

  clearInterval(progressTimer);
  progressTimer = null;
  updateProgress(100);
  updateResult(snapshot);
  updateSummaryCards(snapshot);
  showToast('Расшифровка готова. Ссылка отправлена в чат.', 'success');

  setTimeout(() => {
    showScreen('screen-result');
    resetUploadState();
  }, 450);
}

function startWorkflow() {
  if (!selectedFile) return;

  clearInterval(progressTimer);
  currentWorkflowId = generateWorkflowId();
  if (progressSubtitle) {
    progressSubtitle.textContent = `n8n воркфлоу #${currentWorkflowId}`;
  }

  showScreen('screen-progress');
  updateProgress(0);
  if (sendButton) {
    sendButton.disabled = true;
  }

  let tick = 0;
  const increments = [12, 18, 14, 16, 10];
  progressTimer = setInterval(() => {
    tick += 1;
    const index = Math.min(tick - 1, increments.length - 1);
    const baseIncrement = increments[index] || 8;
    const jitter = Math.random() * 4;
    const nextValue = Math.min(100, currentProgress + Math.max(4, baseIncrement - jitter));
    updateProgress(nextValue);

    if (nextValue >= 100) {
      completeWorkflow();
    }
  }, 800);

  showToast('Файл передан в n8n, отслеживайте прогресс.', 'info');
}

if (uploadInput) {
  uploadInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      resetUploadState();
      return;
    }
    selectedFile = file;
    updateUploadPreview(file);
    if (sendButton) {
      sendButton.disabled = false;
    }
    toggleUploadError(false);
    showToast('Файл добавлен. Нажмите «Отправить в n8n».', 'info');
  });
}

if (clearFileButton) {
  clearFileButton.addEventListener('click', () => {
    resetUploadState();
    showToast('Файл удалён из очереди.', 'info');
  });
}

if (sendButton) {
  sendButton.addEventListener('click', () => {
    if (!selectedFile) {
      toggleUploadError(true, 'Добавьте mp3, чтобы запустить воркфлоу.');
      showToast('Выберите аудио перед отправкой.', 'warning');
      return;
    }
    toggleUploadError(false);
    startWorkflow();
  });
}

if (cancelButton) {
  cancelButton.addEventListener('click', () => {
    if (!progressTimer) {
      showToast('Нет активной задачи для отмены.', 'warning');
      return;
    }
    clearInterval(progressTimer);
    progressTimer = null;
    updateProgress(0);
    setTimelineState('upload');
    if (progressStatus) {
      progressStatus.textContent = 'Процесс остановлен. Файл можно отправить повторно.';
    }
    if (sendButton && selectedFile) {
      sendButton.disabled = false;
    }
    showScreen('screen-upload');
    showToast('Воркфлоу остановлен.', 'warning');
  });
}

if (copyButton) {
  copyButton.addEventListener('click', async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(transcriptPlaceholder);
        showToast('Текст транскрибации скопирован.', 'success');
      } else {
        throw new Error('Clipboard unavailable');
      }
    } catch (error) {
      console.error(error);
      showToast('Не удалось скопировать текст. Скопируйте вручную.', 'warning');
    }
  });
}

if (dashboardButton) {
  dashboardButton.addEventListener('click', () => {
    showToast('Веб-версия личного кабинета появится позже.', 'info');
  });
}

// Показать стартовый экран по умолчанию
showScreen('screen-welcome');

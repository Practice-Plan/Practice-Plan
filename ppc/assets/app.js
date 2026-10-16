/* Shared language, navigation, and utility behavior for PPC pages. */
(function () {
  const languages = ['en', 'zh', 'fr', 'ru', 'ar'];
  const html = document.documentElement;
  const originalContent = new WeakMap();
  const translatedElements = document.querySelectorAll('[data-i18n], [data-i18n-html]');

  translatedElements.forEach((element) => {
    originalContent.set(element, element.innerHTML);
  });

  function getSavedLanguage() {
    try {
      const saved = localStorage.getItem('ppc-lang');
      return languages.includes(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  function detectLanguage() {
    for (const candidate of navigator.languages || [navigator.language || 'en']) {
      const language = candidate.toLowerCase().split('-')[0];
      if (languages.includes(language)) return language;
    }
    return 'en';
  }

  function applyLanguage(language) {
    const code = languages.includes(language) ? language : 'en';
    const translations = (window.PPC_I18N || {})[code] || {};

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const value = translations[element.dataset.i18n];
      element.innerHTML = value === undefined ? originalContent.get(element) : value;
    });

    document.querySelectorAll('[data-i18n-html]').forEach((element) => {
      const value = translations[element.dataset.i18nHtml];
      element.innerHTML = value === undefined ? originalContent.get(element) : value;
    });

    document.querySelectorAll('.copybtn[data-i18n]').forEach((button) => {
      const label = translations[button.dataset.i18n];
      if (label !== undefined) button.dataset.label = label;
      if (translations['copy-ok'] !== undefined) button.dataset.ok = translations['copy-ok'];
    });

    html.lang = code === 'zh' ? 'zh-CN' : code;
    html.dir = code === 'ar' ? 'rtl' : 'ltr';
    const title = (window.PPC_TITLE || {})[code] || (window.PPC_TITLE || {}).en || document.title;
    document.title = title;
    const socialTitle = document.querySelector('meta[property="og:title"]');
    if (socialTitle) socialTitle.content = title;
    const socialLocale = document.querySelector('meta[property="og:locale"]');
    if (socialLocale) {
      socialLocale.content = { en: 'en_US', zh: 'zh_CN', fr: 'fr_FR', ru: 'ru_RU', ar: 'ar_AR' }[code];
    }

    document.querySelectorAll('.lg[data-lang]').forEach((button) => {
      const active = button.dataset.lang === code;
      button.classList.toggle('on', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const description = document.querySelector('meta[name="description"][data-description-i18n]');
    if (description && translations[description.dataset.descriptionI18n] !== undefined) {
      description.content = translations[description.dataset.descriptionI18n];
    }
    const socialDescription = document.querySelector('meta[property="og:description"]');
    if (socialDescription && description) socialDescription.content = description.content;
  }

  document.querySelectorAll('.lg[data-lang]').forEach((button) => {
    button.addEventListener('click', () => {
      const language = button.dataset.lang;
      if (!languages.includes(language)) return;
      try {
        localStorage.setItem('ppc-lang', language);
      } catch {
        // Translation still applies for this visit when storage is unavailable.
      }
      applyLanguage(language);
    });
  });

  applyLanguage(getSavedLanguage() || detectLanguage());
  window.addEventListener('languagechange', () => {
    if (!getSavedLanguage()) applyLanguage(detectLanguage());
  });

  document.querySelectorAll('.aselect').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.aselect').forEach((item) => {
        item.classList.toggle('on', item === button);
      });
      const architecture = button.dataset.arch;
      document.querySelectorAll('[data-arch64]').forEach((size) => {
        size.textContent = size.dataset['arch' + architecture];
      });
    });
  });

  const tocLinks = Array.from(document.querySelectorAll('.toc a[href^="#"]'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const sectionLinks = new Map();
    tocLinks.forEach((link) => {
      const section = document.getElementById(link.getAttribute('href').slice(1));
      if (section) sectionLinks.set(section, link);
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        tocLinks.forEach((link) => link.classList.remove('on'));
        sectionLinks.get(entry.target)?.classList.add('on');
      });
    }, { rootMargin: '-12% 0px -72% 0px', threshold: 0 });

    sectionLinks.forEach((_, section) => observer.observe(section));
  }

  document.querySelectorAll('.copybtn').forEach((button) => {
    button.addEventListener('click', () => {
      const source = document.querySelector(button.dataset.copy || '.report');
      if (!source || !navigator.clipboard) return;

      const originalLabel = button.dataset.label || button.textContent;
      navigator.clipboard.writeText(source.textContent.trim()).then(() => {
        button.textContent = button.dataset.ok || '✓ Copied';
        window.setTimeout(() => { button.textContent = originalLabel; }, 1600);
      });
    });
  });
})();

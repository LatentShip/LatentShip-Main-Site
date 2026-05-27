(function () {
  const data = window.SITE_CONTENT
  if (!data) return

  const state = { activeTag: "All" }
  let faqTracked = false
  const manifestCache = new Map()

  function getSiteBaseUrl() {
    const script =
      document.currentScript ||
      Array.from(document.querySelectorAll("script[src]")).find((item) =>
        item.getAttribute("src")?.endsWith("js/main.js")
      )
    if (!script) return new URL("./", window.location.href)
    const scriptUrl = new URL(script.getAttribute("src"), window.location.href)
    return new URL("../", scriptUrl)
  }

  const siteBaseUrl = getSiteBaseUrl()

  function setText(id, value) {
    const el = document.getElementById(id)
    if (el) el.textContent = value || ""
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
  }

  function getAssetUrl(path) {
    return new URL(path, siteBaseUrl).toString()
  }

  function track(eventName, payload) {
    const eventPayload = { event: eventName, ...payload }
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(eventPayload)
    }
  }

  window.latentshipTrack = track

  function getProjectBySlug(slug) {
    return data.projects.find((project) => project.slug === slug)
  }

  function getAllTags() {
    const tags = new Set()
    data.projects.forEach((project) => project.tags.forEach((tag) => tags.add(tag)))
    const order = ["AI Systems", "Operational Platforms", "Internal Tools", "FinTech", "EdTech", "Coaching", "Prototype"]
    const sorted = order.filter((tag) => tags.has(tag))
    const remaining = Array.from(tags).filter((tag) => !order.includes(tag))
    return ["All", ...sorted, ...remaining]
  }

  function getManifestUrl(slug) {
    return getAssetUrl(`assets/work/${slug}/manifest.json`)
  }

  function getImageUrl(slug, imageName) {
    return getAssetUrl(`assets/work/${slug}/${imageName}`)
  }

  async function fetchProjectImages(slug) {
    if (!slug) return []
    if (manifestCache.has(slug)) return manifestCache.get(slug)

    const request = fetch(getManifestUrl(slug), { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return []
        const manifest = await res.json()
        if (!manifest || !Array.isArray(manifest.images)) return []
        return manifest.images.filter((name) => typeof name === "string" && name.trim())
      })
      .catch(() => [])

    manifestCache.set(slug, request)
    return request
  }

  function buildProjectCard(project, linkPrefix, options = {}) {
    const compact = Boolean(options.compact)
    const arrowIcon = `
      <svg class="inline-arrow-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M18,12h0a2,2,0,0,0-.59-1.4l-4.29-4.3a1,1,0,0,0-1.41,0,1,1,0,0,0,0,1.42L15,11H5a1,1,0,0,0,0,2H15l-3.29,3.29a1,1,0,0,0,1.41,1.42l4.29-4.3A2,2,0,0,0,18,12Z"/>
      </svg>
    `
    return `
      <a
        class="project-card project-card-link ${compact ? "is-compact" : ""}"
        href="${linkPrefix}${project.slug}/"
        data-track="project_click"
        data-project="${project.slug}"
      >
        <div class="project-preview" style="background:${project.preview};" data-project-preview data-project-slug="${project.slug}">
          <p class="project-poster-line">${project.posterLine || ""}</p>
        </div>
        <div class="project-body">
          <p class="project-meta">${project.industry}</p>
          <h3>${project.title}</h3>
          <p class="project-summary">${project.summary}</p>
          ${
            compact
              ? ""
              : `
                <ul class="project-highlights">
                  ${(project.whatWeDid || [])
                    .slice(0, 2)
                    .map((item) => `<li>${item}</li>`)
                    .join("")}
                </ul>
              `
          }
          <p class="project-outcome"><strong>Outcome:</strong> ${project.outcome || "Production-ready baseline delivered."}</p>
          <div class="project-bottom">
            <div class="chips">
              ${project.tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}
            </div>
            <span class="project-link">Read case ${arrowIcon}</span>
          </div>
        </div>
      </a>
    `
  }

  function hydrateProjectCards(container) {
    if (!container) return
    const previews = Array.from(container.querySelectorAll("[data-project-preview][data-project-slug]"))
    previews.forEach(async (preview) => {
      const slug = preview.getAttribute("data-project-slug")
      if (!slug) return
      const images = await fetchProjectImages(slug)
      if (!images.length) return
      if (preview.querySelector("img")) return

      const img = document.createElement("img")
      img.className = "project-preview-image"
      img.src = getImageUrl(slug, images[0])
      img.alt = `${getProjectBySlug(slug)?.title || "Project"} screenshot`
      img.loading = "lazy"
      preview.classList.add("has-image")
      preview.insertBefore(img, preview.firstChild)
    })
  }

  function getInitials(name) {
    const clean = String(name || "").trim()
    if (!clean) return "?"
    const parts = clean.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }

  function renderHero() {
    setText("hero-eyebrow", data.hero.eyebrow)
    setText("hero-qualifier", data.hero.qualifier)
    setText("hero-title", data.hero.title)
    setText("hero-subtitle", data.hero.subtitle)
    setText("hero-card-meta", data.hero.cardMeta)
    setText("hero-card-title", data.hero.cardTitle)

    const bulletList = document.getElementById("hero-bullets")
    if (bulletList) {
      bulletList.innerHTML = (data.hero.bullets || []).map((item) => `<li>${item}</li>`).join("")
    }

    const timeline = document.getElementById("hero-timeline")
    if (timeline) {
      timeline.innerHTML = (data.hero.timeline || [])
        .map(
          (item) => `
            <li>
              <span class="hero-time">${item.label}</span>
              <span>${item.text}</span>
            </li>
          `
        )
        .join("")
    }
  }

  function renderSocialProof() {
    setText("proof-title", data.socialProof?.title || "")
    const badges = document.getElementById("proof-badges")
    if (!badges) return
    badges.innerHTML = (data.socialProof?.badges || []).map((badge) => `<span>${badge}</span>`).join("")
  }

  function renderWhyUs() {
    const list = document.getElementById("why-us-list")
    if (!list) return
    list.innerHTML = data.whyUs
      .map(
        (item) => `
          <li>
            <h3>${item.title}</h3>
            <p>${item.detail}</p>
          </li>
        `
      )
      .join("")
  }

  function renderRoadmap() {
    setText("roadmap-title", data.roadmap.title)
    setText("roadmap-subtitle", data.roadmap.subtitle)
    setText("roadmap-collaboration", data.roadmap.collaboration)
    setText("roadmap-stage-note", data.roadmap.stageNote)

    const steps = document.getElementById("roadmap-steps")
    if (steps) {
      steps.innerHTML = data.roadmap.steps
        .map(
          (step) => `
            <article class="roadmap-step">
              <p class="phase">${step.phase}</p>
              <h3>${step.title}</h3>
              <p class="timeline">${step.timeline || ""}</p>
              <p>${step.detail}</p>
              <ul class="mini-list">
                ${(step.deliverables || []).map((item) => `<li>${item}</li>`).join("")}
              </ul>
            </article>
          `
        )
        .join("")
    }

    const trust = document.getElementById("trust-cards")
    if (trust) {
      trust.innerHTML = data.roadmap.trustCards
        .map(
          (card) => `
            <article class="trust-card">
              <p class="label">${card.label}</p>
              <h3>${card.heading}</h3>
              <p>${card.copy}</p>
            </article>
          `
        )
        .join("")
    }
  }

  function renderFaq() {
    const wrap = document.getElementById("faq-list")
    if (!wrap) return

    wrap.innerHTML = data.faq
      .map(
        (item, idx) => `
          <details class="faq-item" ${idx === 0 ? "open" : ""}>
            <summary>${item.question}</summary>
            <ul>
              ${(item.bullets || []).map((point) => `<li>${point}</li>`).join("")}
            </ul>
          </details>
        `
      )
      .join("")

    wrap.querySelectorAll(".faq-item").forEach((el) => {
      el.addEventListener("toggle", () => {
        if (el.open) {
          const question = el.querySelector("summary")?.textContent || "faq"
          track("faq_open", { question })
        }
      })
    })
  }

  function renderProjectGrid(containerId, linkPrefix, filtered, options = {}) {
    const grid = document.getElementById(containerId)
    if (!grid) return

    const list = filtered || data.projects
    grid.innerHTML = list.map((project) => buildProjectCard(project, linkPrefix, options)).join("")
    hydrateProjectCards(grid)
  }

  function renderWorkPage() {
    const grid = document.getElementById("project-grid")
    if (!grid) return
    const linkPrefix = grid.dataset.projectLinkPrefix || "./"
    const filters = document.getElementById("tag-filters")

    if (filters) {
      const tags = getAllTags()
      filters.innerHTML = tags
        .map(
          (tag) => `
            <button
              type="button"
              class="tag-btn ${state.activeTag === tag ? "active" : ""}"
              data-tag="${tag}"
              aria-pressed="${state.activeTag === tag ? "true" : "false"}"
            >${tag}</button>
          `
        )
        .join("")

      filters.querySelectorAll(".tag-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.activeTag = btn.getAttribute("data-tag") || "All"
          track("project_filter", { tag: state.activeTag })
          renderWorkPage()
        })
      })
    }

    const filtered =
      state.activeTag === "All"
        ? data.projects
        : data.projects.filter((project) => project.tags.includes(state.activeTag))
    renderProjectGrid("project-grid", linkPrefix, filtered)
  }

  function renderFeaturedProjects() {
    const grid = document.getElementById("featured-project-grid")
    if (!grid) return
    const linkPrefix = grid.dataset.projectLinkPrefix || "./work/"
    renderProjectGrid("featured-project-grid", linkPrefix, data.projects.slice(0, 3), { compact: true })
  }

  function renderInlineMarkdown(raw) {
    let s = escapeHtml(raw)
    s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="md-link" href="$2">$1</a>')
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="md-bold">$1</strong>')
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em class="md-em">$2</em>')
    return s
  }

  function renderMarkdownLines(text) {
    const lines = String(text || "").split("\n")
    const gutterWidth = String(lines.length).length
    return lines
      .map((rawLine, idx) => {
        const num = idx + 1
        const gutter = `<span class="md-ln" style="min-width:${gutterWidth + 1}ch;">${num}</span>`
        const trimmed = rawLine.replace(/\s+$/, "")

        if (trimmed === "") {
          return `<div class="md-line md-blank">${gutter}<span class="md-content">&nbsp;</span></div>`
        }
        if (/^---+$/.test(trimmed)) {
          return `<div class="md-line md-hr">${gutter}<span class="md-syntax">${escapeHtml(trimmed)}</span></div>`
        }
        let m
        if ((m = trimmed.match(/^(#{1,3})\s+(.+)$/))) {
          const level = m[1].length
          return `<div class="md-line md-h md-h${level}">${gutter}<span class="md-syntax">${m[1]}&nbsp;</span><span class="md-content">${renderInlineMarkdown(m[2])}</span></div>`
        }
        if ((m = trimmed.match(/^>\s?(.*)$/))) {
          return `<div class="md-line md-bq">${gutter}<span class="md-syntax">&gt;&nbsp;</span><span class="md-content">${renderInlineMarkdown(m[1])}</span></div>`
        }
        if ((m = trimmed.match(/^[-*]\s+(.+)$/))) {
          return `<div class="md-line md-li">${gutter}<span class="md-syntax">-&nbsp;</span><span class="md-content">${renderInlineMarkdown(m[1])}</span></div>`
        }
        return `<div class="md-line md-p">${gutter}<span class="md-content">${renderInlineMarkdown(trimmed)}</span></div>`
      })
      .join("")
  }

  function fileIcon() {
    return `<svg class="ide-file-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M3 1.5A1.5 1.5 0 0 1 4.5 0h5L13 3.5v11a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 14.5v-13Zm6.5.25v2.75h2.75L9.5 1.75Z"/></svg>`
  }

  function sampleIcon() {
    return `<svg class="ide-file-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2.5 2A1.5 1.5 0 0 0 1 3.5v9A1.5 1.5 0 0 0 2.5 14h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 13.5 2h-11ZM4 5h8v1H4V5Zm0 2.5h8v1H4v-1ZM4 10h5v1H4v-1Z"/></svg>`
  }

  function sourceIcon() {
    return `<svg class="ide-mode-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5.7 4.3 1.4 8l4.3 3.7 1-1.2L3.4 8l3.3-2.5-1-1.2Zm4.6 0-1 1.2L12.6 8l-3.3 2.5 1 1.2L14.6 8l-4.3-3.7Z"/></svg>`
  }

  function previewIcon() {
    return `<svg class="ide-mode-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 3C4.5 3 1.7 5.4 1 8c.7 2.6 3.5 5 7 5s6.3-2.4 7-5c-.7-2.6-3.5-5-7-5Zm0 8.3A3.3 3.3 0 1 1 8 4.7a3.3 3.3 0 0 1 0 6.6Zm0-5.3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>`
  }

  function renderMarkdownRich(text) {
    const lines = String(text || "").split("\n")
    const out = []
    let inList = false
    function closeList() {
      if (inList) {
        out.push("</ul>")
        inList = false
      }
    }
    lines.forEach((rawLine) => {
      const line = rawLine.replace(/\s+$/, "")
      if (line === "") {
        closeList()
        return
      }
      if (/^---+$/.test(line)) {
        closeList()
        out.push('<hr class="md-rich-hr">')
        return
      }
      let m
      if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
        closeList()
        const lvl = m[1].length
        out.push(`<h${lvl} class="md-rich-h${lvl}">${renderInlineMarkdown(m[2])}</h${lvl}>`)
        return
      }
      if ((m = line.match(/^>\s?(.*)$/))) {
        closeList()
        out.push(`<blockquote class="md-rich-bq">${renderInlineMarkdown(m[1])}</blockquote>`)
        return
      }
      if ((m = line.match(/^[-*]\s+(.+)$/))) {
        if (!inList) {
          out.push('<ul class="md-rich-ul">')
          inList = true
        }
        out.push(`<li>${renderInlineMarkdown(m[1])}</li>`)
        return
      }
      closeList()
      out.push(`<p class="md-rich-p">${renderInlineMarkdown(line)}</p>`)
    })
    closeList()
    return out.join("")
  }

  function renderSoulDoc() {
    if (document.body.dataset.page !== "about") return
    const doc = data.soulDoc
    if (!doc || !Array.isArray(doc.tabs) || !doc.tabs.length) return

    const tabs = doc.tabs
    const samples = Array.isArray(doc.samples) ? doc.samples : []
    let activeId = tabs[0].id
    let mode = "source"

    const tabbar = document.getElementById("ide-tabbar")
    const viewport = document.getElementById("ide-viewport")
    const tree = document.getElementById("ide-tree")
    const path = document.getElementById("ide-path")
    const branchEl = document.getElementById("ide-branch")
    const statusBranch = document.getElementById("ide-status-branch")
    const cursor = document.getElementById("ide-cursor")
    const modeChip = document.getElementById("ide-mode-chip")

    if (branchEl) branchEl.textContent = `${doc.repo || ""} · ${doc.branch || "main"}`
    if (statusBranch) statusBranch.textContent = doc.branch || "main"

    function renderTabbar() {
      if (!tabbar) return
      const tabsHtml = tabs
        .map(
          (tab) => `
            <button type="button" class="ide-tab ${tab.id === activeId ? "is-active" : ""}" role="tab" aria-selected="${tab.id === activeId}" data-tab="${tab.id}">
              ${fileIcon()}<span>${escapeHtml(tab.filename)}</span>
            </button>
          `
        )
        .join("")
      tabbar.innerHTML = `
        <div class="ide-tabbar-tabs">${tabsHtml}</div>
        <div class="ide-mode-toggle" role="group" aria-label="View mode">
          <button type="button" class="ide-mode-btn ${mode === "source" ? "is-active" : ""}" data-mode="source" aria-pressed="${mode === "source"}">${sourceIcon()}<span>Source</span></button>
          <button type="button" class="ide-mode-btn ${mode === "preview" ? "is-active" : ""}" data-mode="preview" aria-pressed="${mode === "preview"}">${previewIcon()}<span>Preview</span></button>
        </div>
      `
      tabbar.querySelectorAll(".ide-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-tab")
          if (id) selectTab(id)
        })
      })
      tabbar.querySelectorAll(".ide-mode-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const next = btn.getAttribute("data-mode")
          if (next) setMode(next)
        })
      })
    }

    function renderTree() {
      if (!tree) return
      const fileItems = tabs
        .map(
          (tab) => `
            <li class="ide-tree-file ${tab.id === activeId ? "is-active" : ""}" data-tab="${tab.id}">
              ${fileIcon()}<span>${escapeHtml(tab.filename)}</span>
            </li>
          `
        )
        .join("")
      const sampleItems = samples
        .map(
          (f) => `
            <li class="ide-tree-file is-sample" title="${escapeHtml(f.note || "sample artifact")}">
              ${sampleIcon()}<span>${escapeHtml(f.filename)}</span>
              <span class="ide-tree-tag">sample</span>
            </li>
          `
        )
        .join("")
      tree.innerHTML = `
        <li class="ide-tree-folder">
          <span class="ide-tree-twist">▾</span><span>${escapeHtml(doc.repo || "latentship")}</span>
        </li>
        ${fileItems}
        ${
          samples.length
            ? `
              <li class="ide-tree-folder ide-tree-folder-sub">
                <span class="ide-tree-twist">▾</span><span>engagement</span>
              </li>
              ${sampleItems}
            `
            : ""
        }
      `
      tree.querySelectorAll(".ide-tree-file[data-tab]").forEach((el) => {
        el.addEventListener("click", () => {
          const id = el.getAttribute("data-tab")
          if (id) selectTab(id)
        })
      })
    }

    function renderViewport() {
      if (!viewport) return
      const tab = tabs.find((t) => t.id === activeId) || tabs[0]
      const lineCount = String(tab.body || "").split("\n").length
      if (mode === "preview") {
        viewport.innerHTML = `<div class="md-doc md-rich">${renderMarkdownRich(tab.body)}</div>`
      } else {
        viewport.innerHTML = `<div class="md-doc">${renderMarkdownLines(tab.body)}</div>`
      }
      if (path) path.textContent = `~/${doc.repo || "latentship"}/${tab.filename}`
      if (cursor) {
        cursor.textContent = mode === "preview" ? "" : `Ln ${lineCount}, Col 1`
        cursor.style.display = mode === "preview" ? "none" : ""
      }
      if (modeChip) modeChip.textContent = mode === "preview" ? "Preview" : "Markdown"
      viewport.scrollTop = 0
    }

    function selectTab(id) {
      if (id === activeId) return
      activeId = id
      renderTabbar()
      renderTree()
      renderViewport()
      track("soul_tab_open", { tab: id, mode })
    }

    function setMode(next) {
      if (next === mode) return
      mode = next
      renderTabbar()
      renderViewport()
      track("soul_mode_switch", { mode })
    }

    renderTabbar()
    renderTree()
    renderViewport()

    document.addEventListener("keydown", (event) => {
      if (document.body.dataset.page !== "about") return
      const target = event.target
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
      if (event.key === "t" || event.key === "T") {
        const idx = tabs.findIndex((t) => t.id === activeId)
        const next = tabs[(idx + 1) % tabs.length]
        if (next) selectTab(next.id)
      } else if (event.key === "p" || event.key === "P") {
        setMode(mode === "source" ? "preview" : "source")
      }
    })
  }

  function renderProjectGallery(project, images) {
    const preview = document.getElementById("project-preview")
    const controls = document.getElementById("project-gallery-controls")
    const thumbs = document.getElementById("project-gallery-thumbs")
    const prevButton = document.getElementById("gallery-prev")
    const nextButton = document.getElementById("gallery-next")
    const status = document.getElementById("project-gallery-status")
    let gestureHint = document.getElementById("project-gallery-gesture")

    if (!gestureHint && preview?.parentElement) {
      gestureHint = document.createElement("p")
      gestureHint.id = "project-gallery-gesture"
      gestureHint.className = "gallery-gesture-hint"
      gestureHint.textContent = "Tip: swipe the image to browse screenshots."
      if (thumbs) {
        preview.parentElement.insertBefore(gestureHint, thumbs)
      } else if (status) {
        preview.parentElement.insertBefore(gestureHint, status)
      } else {
        preview.parentElement.appendChild(gestureHint)
      }
    }

    if (!preview) return

    if (!images.length) {
      preview.innerHTML = ""
      preview.style.background = project.preview
      preview.classList.remove("is-swipeable")
      preview.ontouchstart = null
      preview.ontouchend = null
      preview.ontouchcancel = null
      if (controls) controls.hidden = true
      if (thumbs) thumbs.innerHTML = ""
      if (gestureHint) gestureHint.hidden = true
      if (status) status.textContent = "No screenshots added yet."
      return
    }

    const urls = images.map((name) => getImageUrl(project.slug, name))
    let index = 0
    const canSwipeGallery =
      urls.length > 1 &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: none) and (pointer: coarse)").matches
    preview.style.background = "#0b1114"
    preview.innerHTML = '<img class="project-gallery-image" alt="" />'
    const img = preview.querySelector("img")

    function update(nextIndex) {
      index = (nextIndex + urls.length) % urls.length
      if (img) {
        img.src = urls[index]
        img.alt = `${project.title} screenshot ${index + 1}`
      }
      if (status) status.textContent = `Screenshot ${index + 1} of ${urls.length}`
      if (thumbs) {
        thumbs.querySelectorAll(".gallery-thumb").forEach((button, buttonIndex) => {
          const active = buttonIndex === index
          button.classList.toggle("active", active)
          button.setAttribute("aria-current", active ? "true" : "false")
        })
      }
    }

    if (controls) controls.hidden = urls.length <= 1
    if (gestureHint) gestureHint.hidden = !canSwipeGallery
    preview.classList.toggle("is-swipeable", canSwipeGallery)
    if (thumbs) {
      thumbs.innerHTML = urls
        .map(
          (url, thumbIndex) => `
            <button type="button" class="gallery-thumb" data-gallery-index="${thumbIndex}" aria-label="Show screenshot ${thumbIndex + 1}">
              <img src="${url}" alt="${project.title} thumbnail ${thumbIndex + 1}" loading="lazy" />
            </button>
          `
        )
        .join("")
      thumbs.querySelectorAll(".gallery-thumb").forEach((button) => {
        button.addEventListener("click", () => {
          const nextIndex = Number(button.getAttribute("data-gallery-index"))
          update(nextIndex)
        })
      })
    }

    if (prevButton) prevButton.onclick = () => update(index - 1)
    if (nextButton) nextButton.onclick = () => update(index + 1)
    preview.tabIndex = 0
    preview.onkeydown = (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        update(index - 1)
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        update(index + 1)
      }
    }

    preview.ontouchstart = null
    preview.ontouchend = null
    preview.ontouchcancel = null

    if (canSwipeGallery) {
      let startX = 0
      let startY = 0
      let trackingSwipe = false

      preview.ontouchstart = (event) => {
        const touch = event.changedTouches?.[0]
        if (!touch) return
        startX = touch.clientX
        startY = touch.clientY
        trackingSwipe = true
      }

      preview.ontouchend = (event) => {
        if (!trackingSwipe) return
        trackingSwipe = false
        const touch = event.changedTouches?.[0]
        if (!touch) return

        const deltaX = touch.clientX - startX
        const deltaY = touch.clientY - startY
        const absX = Math.abs(deltaX)
        const absY = Math.abs(deltaY)
        if (absX < 48 || absX < absY * 1.2) return

        if (deltaX > 0) {
          update(index - 1)
        } else {
          update(index + 1)
        }

        if (gestureHint) gestureHint.hidden = true
      }

      preview.ontouchcancel = () => {
        trackingSwipe = false
      }
    }

    update(0)
  }

  async function renderProjectPage() {
    const slug = document.body.dataset.projectSlug
    if (!slug) return

    const project = getProjectBySlug(slug)
    if (!project) {
      setText("project-title", "Project not found")
      setText("project-summary", "Please return to the work page and choose a valid project.")
      return
    }

    setText("project-industry", project.industry)
    setText("project-title", project.title)
    setText("project-summary", project.detail)
    setText("project-duration", project.duration)

    const chips = document.getElementById("project-tags")
    if (chips) chips.innerHTML = project.tags.map((tag) => `<span class="chip">${tag}</span>`).join("")

    const deliverables = document.getElementById("project-deliverables")
    if (deliverables) {
      deliverables.innerHTML = (project.deliverables || []).map((item) => `<li>${item}</li>`).join("")
    }

    const status = document.getElementById("project-gallery-status")
    if (status) status.textContent = "Loading screenshots..."
    renderProjectGallery(project, await fetchProjectImages(slug))

    const related = document.getElementById("related-project-grid")
    if (related) {
      const linkPrefix = related.dataset.projectLinkPrefix || "../"
      const relatedProjects = data.projects.filter((item) => item.slug !== slug).slice(0, 3)
      related.innerHTML = relatedProjects.map((item) => buildProjectCard(item, linkPrefix)).join("")
      hydrateProjectCards(related)
    }
  }

  function setupRevealAnimations() {
    const elements = Array.from(document.querySelectorAll("[data-reveal]"))
    if (!elements.length) return

    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-visible"))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.06, rootMargin: "0px 0px -6% 0px" }
    )

    elements.forEach((el) => observer.observe(el))
  }

  function setupInteractionTracking() {
    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-track]")
      if (target) {
        const name = target.getAttribute("data-track")
        if (!name) return
        track(name, {
          label: target.textContent?.trim() || "",
          project: target.getAttribute("data-project") || undefined,
          href: target.getAttribute("href") || undefined
        })
        return
      }

      const cta = event.target.closest(".nav-cta, .primary-cta, .footer-cta-link")
      if (cta) {
        track("cta_primary", {
          label: cta.textContent?.trim() || "",
          href: cta.getAttribute("href") || undefined
        })
      }
    })
  }

  function setupScrollTracking() {
    const faq = document.getElementById("faq")
    if (!faq || !("IntersectionObserver" in window)) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !faqTracked) {
            faqTracked = true
            track("faq_seen", { page: document.body.dataset.page || "unknown" })
          }
        })
      },
      { threshold: 0.35 }
    )
    observer.observe(faq)
  }

  function setupNavPill() {
    const nav = document.querySelector(".nav-links")
    if (!nav) return

    const links = Array.from(nav.querySelectorAll("a"))
    const activeIndex = links.findIndex((link) => link.classList.contains("active"))
    if (!links.length || activeIndex < 0) return

    const navPillKey = "latentship_nav_pill_index"
    const pill = document.createElement("span")
    pill.className = "nav-active-pill"
    pill.setAttribute("aria-hidden", "true")
    nav.prepend(pill)

    function shouldEnablePill() {
      if (window.matchMedia("(max-width: 640px)").matches) return false
      const firstTop = links[0]?.offsetTop ?? 0
      return links.every((link) => Math.abs(link.offsetTop - firstTop) < 2)
    }

    function positionPill(target, animated) {
      if (!target) return
      if (!animated) {
        pill.style.transition = "none"
      } else {
        pill.style.removeProperty("transition")
      }
      pill.style.width = `${target.offsetWidth}px`
      pill.style.transform = `translateX(${target.offsetLeft}px)`
      if (!animated) {
        requestAnimationFrame(() => {
          pill.style.removeProperty("transition")
        })
      }
    }

    function enablePill() {
      nav.classList.add("is-pill-ready")
    }

    function disablePill() {
      nav.classList.remove("is-pill-ready")
      pill.style.removeProperty("width")
      pill.style.removeProperty("transform")
    }

    function readStoredIndex() {
      try {
        const raw = window.sessionStorage.getItem(navPillKey)
        if (!raw) return null
        const parsed = Number.parseInt(raw, 10)
        if (!Number.isInteger(parsed)) return null
        if (parsed < 0 || parsed >= links.length) return null
        return parsed
      } catch {
        return null
      }
    }

    function writeStoredIndex(index) {
      try {
        window.sessionStorage.setItem(navPillKey, String(index))
      } catch {
        // Ignore storage issues in private/restricted contexts.
      }
    }

    function syncPill() {
      if (!shouldEnablePill()) {
        disablePill()
        return
      }

      enablePill()
      const activeLink = links[activeIndex]
      const storedIndex = readStoredIndex()
      const startLink =
        storedIndex !== null && storedIndex !== activeIndex ? links[storedIndex] : activeLink

      positionPill(startLink, false)
      if (startLink !== activeLink) {
        requestAnimationFrame(() => positionPill(activeLink, true))
      }
    }

    links.forEach((link, index) => {
      link.addEventListener("click", () => writeStoredIndex(index))
    })

    let resizeRaf = null
    window.addEventListener("resize", () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null
        syncPill()
      })
    })

    syncPill()
  }

  function normalizePath(pathname) {
    const clean = String(pathname || "").trim()
    if (!clean) return "/"
    return clean.endsWith("/") ? clean : `${clean}/`
  }

  function setupMobileHeaderBehavior() {
    const header = document.querySelector(".site-header")
    const navCta = header?.querySelector(".nav-cta")
    if (!header || !navCta) return

    const currentPath = normalizePath(window.location.pathname)
    const ctaPath = normalizePath(new URL(navCta.getAttribute("href") || "", window.location.href).pathname)
    const shouldRenderBottomCta = ctaPath !== currentPath

    let bottomCta = null
    if (shouldRenderBottomCta) {
      bottomCta = document.createElement("div")
      bottomCta.className = "mobile-sticky-cta"
      bottomCta.innerHTML = `
        <a href="${navCta.getAttribute("href") || "#"}" class="nav-cta mobile-sticky-cta-link" data-track="cta_primary">
          ${navCta.textContent?.trim() || "Book a 15-min scoping call"}
        </a>
      `
      document.body.appendChild(bottomCta)
    }

    function isMobileMode() {
      if (typeof window.matchMedia !== "function") return false
      return (
        window.matchMedia("(max-width: 640px)").matches &&
        window.matchMedia("(hover: none) and (pointer: coarse)").matches
      )
    }

    let isTicking = false
    function syncMobileHeaderState() {
      isTicking = false

      if (!isMobileMode()) {
        document.body.classList.remove("mobile-header-collapsed")
        if (bottomCta) bottomCta.classList.remove("is-visible")
        return
      }

      const offset = window.scrollY || window.pageYOffset || 0
      const shouldCollapse = offset > 88
      document.body.classList.toggle("mobile-header-collapsed", shouldCollapse)
      if (bottomCta) bottomCta.classList.toggle("is-visible", shouldCollapse)
    }

    function requestSync() {
      if (isTicking) return
      isTicking = true
      window.requestAnimationFrame(syncMobileHeaderState)
    }

    window.addEventListener("scroll", requestSync, { passive: true })
    window.addEventListener("resize", requestSync)
    window.addEventListener("orientationchange", requestSync)
    requestSync()
  }

  function init() {
    renderHero()
    renderSocialProof()
    renderWhyUs()
    renderRoadmap()
    renderFaq()
    renderFeaturedProjects()
    renderWorkPage()
    renderSoulDoc()
    renderProjectPage()
    setupRevealAnimations()
    setupInteractionTracking()
    setupScrollTracking()
    setupNavPill()
    setupMobileHeaderBehavior()
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }
})()

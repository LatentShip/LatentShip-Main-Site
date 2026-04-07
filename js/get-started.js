/*
 * Updated lead intake logic for LatentShip's get‑started form.
 *
 * This script handles the multi‑step intake form, validates input,
 * collects the payload, and posts it to the configured endpoint.
 * It has not been modified from the original logic other than
 * retaining compatibility with the updated Resend integration via
 * content.js. The form configuration (endpoint, method, provider,
 * source) is defined in js/content.js under SITE_CONTENT.leadForm.
 */

// Wrap everything in an IIFE to avoid polluting the global scope.
(function () {
  // Only run on the get‑started page
  if (document.body.dataset.page !== "get-started") return

  // Grab the form configuration from the global SITE_CONTENT object
  const content = window.SITE_CONTENT || {}
  const formConfig = content.leadForm || {}
  // Track function will be a no‑op if latentshipTrack isn't defined
  const track = typeof window.latentshipTrack === "function" ? window.latentshipTrack : function () {}

  // Get references to DOM elements
  const form = document.getElementById("lead-flow")
  if (!form) return

  const steps = Array.from(form.querySelectorAll(".lead-step"))
  const progressWrap = document.querySelector(".lead-progress")
  const progressBar = document.getElementById("lead-progress-bar")
  const progressText = document.getElementById("lead-progress-text")
  const errorEl = document.getElementById("lead-error")
  const backButton = document.getElementById("lead-back")
  const nextButton = document.getElementById("lead-next")
  const submitButton = document.getElementById("lead-submit")
  const successPanel = document.getElementById("lead-success")
  const honeypot = document.getElementById("lead-website")

  const briefQuestion = document.getElementById("lead-brief-question")
  const briefLabel = document.getElementById("lead-brief-label")
  const briefInput = document.getElementById("lead-brief")
  const firstNameInput = document.getElementById("lead-first-name")
  const emailInput = document.getElementById("lead-email")
  const companyInput = document.getElementById("lead-company")

  const totalSteps = 4
  let currentStep = 1
  let isSending = false
  let startedTracked = false

  // Define prompts for the project brief based on need type
  const promptByNeed = {
    "Build a new AI product or workflow": {
      question: "What are you trying to build?",
      label: "What are you trying to build?",
      placeholder:
        "Example: We need an AI-assisted operations workspace that routes approvals, summarizes context, and tracks execution."
    },
    "Build an agent for an existing workflow": {
      question: "Which workflow should the agent handle?",
      label: "Which workflow should the agent handle?",
      placeholder:
        "Example: We want an agent to handle inbound requests, summarize context, and route approvals in our existing operations workflow."
    },
    "Architecture / advisory / rescue": {
      question: "What do you want help thinking through?",
      label: "What do you want help thinking through?",
      placeholder:
        "Example: We need help stabilizing scope, fixing architecture decisions, and planning a practical path to launch."
    }
  }

  function setError(message) {
    if (errorEl) errorEl.textContent = message || ""
  }

  function getSelectedValue(name) {
    return form.querySelector(`input[name="${name}"]:checked`)?.value || ""
  }

  function refreshChoiceCards() {
    form.querySelectorAll(".choice-card").forEach((card) => {
      const input = card.querySelector("input")
      card.classList.toggle("is-selected", Boolean(input?.checked))
    })
  }

  function updateStepPrompt() {
    const prompt = promptByNeed[getSelectedValue("needType")] || promptByNeed["Build a new AI product or workflow"]
    if (briefQuestion) briefQuestion.textContent = prompt.question
    if (briefLabel) briefLabel.textContent = prompt.label
    if (briefInput && !briefInput.value.trim()) briefInput.placeholder = prompt.placeholder
  }

  function showStep(stepNumber) {
    currentStep = stepNumber
    steps.forEach((step) => {
      const active = Number(step.dataset.step) === stepNumber
      step.hidden = !active
      step.classList.toggle("is-active", active)
    })
    if (progressBar) progressBar.style.width = `${(stepNumber / totalSteps) * 100}%`
    if (progressText) progressText.textContent = `Step ${stepNumber} of ${totalSteps}`
    if (backButton) backButton.hidden = stepNumber === 1
    if (nextButton) nextButton.hidden = stepNumber === totalSteps
    if (submitButton) submitButton.hidden = stepNumber !== totalSteps
    setError("")
    refreshChoiceCards()
  }

  function validateStep(stepNumber) {
    if (stepNumber === 1) {
      const value = getSelectedValue("needType")
      return value ? { ok: true, value } : { ok: false, message: "Select what you need help with first." }
    }
    if (stepNumber === 2) {
      const value = (briefInput?.value || "").trim()
      return value.length >= 12
        ? { ok: true, value }
        : { ok: false, message: "Add a short project brief so we can prepare properly." }
    }
    if (stepNumber === 3) {
      const value = getSelectedValue("timeline")
      return value ? { ok: true, value } : { ok: false, message: "Select a timeline so we can prioritize follow-up." }
    }
    if (stepNumber === 4) {
      const firstName = (firstNameInput?.value || "").trim()
      const email = (emailInput?.value || "").trim()
      const company = (companyInput?.value || "").trim()
      if (!firstName) return { ok: false, message: "Enter your first name." }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a valid email address." }
      if (!company) return { ok: false, message: "Enter your company name." }
      return { ok: true, value: email }
    }
    return { ok: true }
  }

  function collectPayload() {
    return {
      needType: getSelectedValue("needType"),
      projectBrief: (briefInput?.value || "").trim(),
      timeline: getSelectedValue("timeline"),
      firstName: (firstNameInput?.value || "").trim(),
      email: (emailInput?.value || "").trim(),
      company: (companyInput?.value || "").trim(),
      submittedAt: new Date().toISOString(),
      source: formConfig.source || "latentship-site",
      page: window.location.href,
      _subject: "New LatentShip intake"
    }
  }

  function setSendingState(sending) {
    isSending = sending
    if (backButton) backButton.disabled = sending
    if (nextButton) nextButton.disabled = sending
    if (submitButton) {
      submitButton.disabled = sending
      submitButton.textContent = sending ? "Submitting..." : "Submit intake"
    }
  }

  function showSuccess() {
    form.hidden = true
    if (progressWrap) progressWrap.hidden = true
    if (successPanel) successPanel.hidden = false
  }

  function handleNext() {
    const validation = validateStep(currentStep)
    if (!validation.ok) {
      setError(validation.message)
      return
    }
    if (!startedTracked) {
      startedTracked = true
      track("lead_form_start", { page: "get-started" })
    }
    track("lead_form_step_complete", { step: currentStep, value: String(validation.value || "").slice(0, 120) })
    if (currentStep === 1) updateStepPrompt()
    showStep(Math.min(totalSteps, currentStep + 1))
  }

  async function submitLead(event) {
    event.preventDefault()
    if (isSending) return

    const validation = validateStep(4)
    if (!validation.ok) {
      setError(validation.message)
      return
    }
    track("lead_form_step_complete", { step: 4, value: String(validation.value || "").slice(0, 120) })

    // If honeypot field has value, treat as spam and silently succeed
    if ((honeypot?.value || "").trim()) {
      track("lead_form_submit_success", { provider: formConfig.provider || "unknown", spam: true })
      showSuccess()
      return
    }

    const payload = collectPayload()
    track("lead_form_submit", { needType: payload.needType, timeline: payload.timeline })

    setSendingState(true)
    setError("")
    try {
      const endpoint = (formConfig.endpoint || "").trim()
      if (!endpoint || endpoint.includes("REPLACE_WITH_YOUR_FORM_ID")) {
        throw new Error("Form endpoint is not configured.")
      }

      const response = await fetch(endpoint, {
        method: formConfig.method || "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error(`Submission failed with status ${response.status}`)

      track("lead_form_submit_success", { provider: formConfig.provider || "unknown" })
      showSuccess()
    } catch (error) {
      track("lead_form_submit_error", { message: error?.message || "unknown_error" })
      if (String(error?.message || "").includes("not configured")) {
        setError("Intake endpoint not configured yet. Set SITE_CONTENT.leadForm.endpoint in js/content.js.")
      } else {
        setError("We could not submit your intake right now. Please try again in a minute or email hello@latentship.com.")
      }
    } finally {
      setSendingState(false)
    }
  }

  form.addEventListener("change", () => {
    refreshChoiceCards()
    if (currentStep === 1) updateStepPrompt()
    setError("")
  })

  form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return
    const inTextarea = event.target instanceof HTMLElement && event.target.tagName === "TEXTAREA"
    if (inTextarea && !event.ctrlKey && !event.metaKey) return
    if (currentStep < totalSteps) {
      event.preventDefault()
      handleNext()
    }
  })

  backButton?.addEventListener("click", () => {
    if (!isSending) showStep(Math.max(1, currentStep - 1))
  })
  nextButton?.addEventListener("click", handleNext)
  form.addEventListener("submit", submitLead)

  updateStepPrompt()
  showStep(1)
})()
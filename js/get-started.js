/*
 * Lead intake flow for the get-started page.
 * Includes multi-step validation and Turnstile token acquisition at submit time.
 */

(function () {
  if (document.body.dataset.page !== "get-started") return;

  const content = window.SITE_CONTENT || {};
  const formConfig = content.leadForm || {};
  const track = typeof window.latentshipTrack === "function" ? window.latentshipTrack : function () {};

  const form = document.getElementById("lead-flow");
  if (!form) return;

  const steps = Array.from(form.querySelectorAll(".lead-step"));
  const progressWrap = document.querySelector(".lead-progress");
  const progressBar = document.getElementById("lead-progress-bar");
  const progressText = document.getElementById("lead-progress-text");
  const errorEl = document.getElementById("lead-error");
  const backButton = document.getElementById("lead-back");
  const nextButton = document.getElementById("lead-next");
  const submitButton = document.getElementById("lead-submit");
  const successPanel = document.getElementById("lead-success");
  const honeypot = document.getElementById("lead-website");
  const turnstileSlot = document.getElementById("lead-turnstile");

  const briefQuestion = document.getElementById("lead-brief-question");
  const briefLabel = document.getElementById("lead-brief-label");
  const briefInput = document.getElementById("lead-brief");
  const firstNameInput = document.getElementById("lead-first-name");
  const emailInput = document.getElementById("lead-email");
  const companyInput = document.getElementById("lead-company");

  const totalSteps = 4;
  let currentStep = 1;
  let isSending = false;
  let startedTracked = false;
  let turnstileWidgetId = null;
  let pendingTurnstile = null;

  const turnstileSiteKey = String(formConfig.turnstileSiteKey || "").trim();
  const turnstileAction = String(formConfig.turnstileAction || "lead_intake_submit").trim();

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
  };

  function setError(message) {
    if (errorEl) errorEl.textContent = message || "";
  }

  function getSelectedValue(name) {
    return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
  }

  function refreshChoiceCards() {
    form.querySelectorAll(".choice-card").forEach((card) => {
      const input = card.querySelector("input");
      card.classList.toggle("is-selected", Boolean(input?.checked));
    });
  }

  function updateStepPrompt() {
    const prompt = promptByNeed[getSelectedValue("needType")] || promptByNeed["Build a new AI product or workflow"];
    if (briefQuestion) briefQuestion.textContent = prompt.question;
    if (briefLabel) briefLabel.textContent = prompt.label;
    if (briefInput && !briefInput.value.trim()) briefInput.placeholder = prompt.placeholder;
  }

  function showStep(stepNumber) {
    currentStep = stepNumber;
    steps.forEach((step) => {
      const active = Number(step.dataset.step) === stepNumber;
      step.hidden = !active;
      step.classList.toggle("is-active", active);
    });
    if (progressBar) progressBar.style.width = `${(stepNumber / totalSteps) * 100}%`;
    if (progressText) progressText.textContent = `Step ${stepNumber} of ${totalSteps}`;
    if (backButton) backButton.hidden = stepNumber === 1;
    if (nextButton) nextButton.hidden = stepNumber === totalSteps;
    if (submitButton) submitButton.hidden = stepNumber !== totalSteps;
    setError("");
    refreshChoiceCards();
  }

  function validateStep(stepNumber) {
    if (stepNumber === 1) {
      const value = getSelectedValue("needType");
      return value ? { ok: true, value } : { ok: false, message: "Select what you need help with first." };
    }
    if (stepNumber === 2) {
      const value = (briefInput?.value || "").trim();
      return value.length >= 12
        ? { ok: true, value }
        : { ok: false, message: "Add a short project brief so we can prepare properly." };
    }
    if (stepNumber === 3) {
      const value = getSelectedValue("timeline");
      return value ? { ok: true, value } : { ok: false, message: "Select a timeline so we can prioritize follow-up." };
    }
    if (stepNumber === 4) {
      const firstName = (firstNameInput?.value || "").trim();
      const email = (emailInput?.value || "").trim();
      const company = (companyInput?.value || "").trim();
      if (!firstName) return { ok: false, message: "Enter your first name." };
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a valid email address." };
      if (!company) return { ok: false, message: "Enter your company name." };
      return { ok: true, value: email };
    }
    return { ok: true };
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
      page: window.location.href
    };
  }

  function setSendingState(sending) {
    isSending = sending;
    if (backButton) backButton.disabled = sending;
    if (nextButton) nextButton.disabled = sending;
    if (submitButton) {
      submitButton.disabled = sending;
      submitButton.textContent = sending ? "Submitting..." : "Submit intake";
    }
  }

  function showSuccess() {
    form.hidden = true;
    if (progressWrap) progressWrap.hidden = true;
    if (successPanel) successPanel.hidden = false;
  }

  function isTurnstileConfigured() {
    return Boolean(turnstileSiteKey) && !turnstileSiteKey.includes("REPLACE_WITH_TURNSTILE_SITE_KEY");
  }

  async function waitForTurnstileApi(timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.turnstile && typeof window.turnstile.render === "function") return;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    throw new Error("Turnstile script failed to load.");
  }

  async function ensureTurnstileWidget() {
    if (!isTurnstileConfigured()) {
      throw new Error("Turnstile is not configured.");
    }
    if (turnstileWidgetId !== null) return;
    if (!turnstileSlot) {
      throw new Error("Turnstile container is missing.");
    }

    await waitForTurnstileApi(10000);

    turnstileWidgetId = window.turnstile.render(turnstileSlot, {
      sitekey: turnstileSiteKey,
      action: turnstileAction,
      appearance: "interaction-only",
      execution: "execute",
      callback: (token) => {
        if (pendingTurnstile) {
          pendingTurnstile.resolve(token);
          pendingTurnstile = null;
        }
      },
      "error-callback": () => {
        if (pendingTurnstile) {
          pendingTurnstile.reject(new Error("Turnstile verification failed."));
          pendingTurnstile = null;
        }
      },
      "expired-callback": () => {
        if (pendingTurnstile) {
          pendingTurnstile.reject(new Error("Turnstile token expired."));
          pendingTurnstile = null;
        }
      }
    });
  }

  function resetTurnstileWidget() {
    if (window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  async function getTurnstileToken() {
    await ensureTurnstileWidget();
    const cachedToken = window.turnstile.getResponse(turnstileWidgetId);
    if (cachedToken) return cachedToken;

    return new Promise((resolve, reject) => {
      pendingTurnstile = { resolve, reject };
      window.turnstile.execute(turnstileWidgetId);
      setTimeout(() => {
        if (pendingTurnstile) {
          pendingTurnstile.reject(new Error("Turnstile verification timed out."));
          pendingTurnstile = null;
        }
      }, 15000);
    });
  }

  function handleNext() {
    const validation = validateStep(currentStep);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    if (!startedTracked) {
      startedTracked = true;
      track("lead_form_start", { page: "get-started" });
    }
    track("lead_form_step_complete", { step: currentStep, value: String(validation.value || "").slice(0, 120) });
    if (currentStep === 1) updateStepPrompt();
    showStep(Math.min(totalSteps, currentStep + 1));
  }

  async function submitLead(event) {
    event.preventDefault();
    if (isSending) return;

    const validation = validateStep(4);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    track("lead_form_step_complete", { step: 4, value: String(validation.value || "").slice(0, 120) });

    if ((honeypot?.value || "").trim()) {
      track("lead_form_submit_success", { provider: formConfig.provider || "unknown", spam: true });
      showSuccess();
      return;
    }

    const payload = collectPayload();
    track("lead_form_submit", { needType: payload.needType, timeline: payload.timeline });

    setSendingState(true);
    setError("");
    try {
      const endpoint = (formConfig.endpoint || "").trim();
      if (!endpoint || endpoint.includes("REPLACE_WITH_YOUR_FORM_ID")) {
        throw new Error("Form endpoint is not configured.");
      }

      const turnstileToken = await getTurnstileToken();
      payload.turnstileToken = turnstileToken;

      const response = await fetch(endpoint, {
        method: formConfig.method || "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let message = `Submission failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          if (typeof errorData?.error === "string" && errorData.error.trim()) {
            message = errorData.error;
          }
        } catch (_err) {
          // Keep fallback message.
        }
        throw new Error(message);
      }

      track("lead_form_submit_success", { provider: formConfig.provider || "unknown" });
      showSuccess();
    } catch (error) {
      resetTurnstileWidget();
      track("lead_form_submit_error", { message: error?.message || "unknown_error" });
      const errorMessage = String(error?.message || "");
      if (errorMessage.includes("Form endpoint is not configured")) {
        setError("Intake endpoint not configured yet. Set SITE_CONTENT.leadForm.endpoint in js/content.js.");
      } else if (errorMessage.includes("Turnstile is not configured")) {
        setError("Captcha is not configured yet. Add SITE_CONTENT.leadForm.turnstileSiteKey in js/content.js.");
      } else if (errorMessage.toLowerCase().includes("verification")) {
        setError("Verification failed. Please try again.");
      } else {
        setError("We could not submit your intake right now. Please try again in a minute or email hello@latentship.com.");
      }
    } finally {
      setSendingState(false);
    }
  }

  form.addEventListener("change", () => {
    refreshChoiceCards();
    if (currentStep === 1) updateStepPrompt();
    setError("");
  });

  form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const inTextarea = event.target instanceof HTMLElement && event.target.tagName === "TEXTAREA";
    if (inTextarea && !event.ctrlKey && !event.metaKey) return;
    if (currentStep < totalSteps) {
      event.preventDefault();
      handleNext();
    }
  });

  backButton?.addEventListener("click", () => {
    if (!isSending) showStep(Math.max(1, currentStep - 1));
  });
  nextButton?.addEventListener("click", handleNext);
  form.addEventListener("submit", submitLead);

  updateStepPrompt();
  showStep(1);
})();

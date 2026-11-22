import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import OnboardingLayout from '../../components/onboarding/OnboardingLayout'
import {
  BrandStep,
  GoalsStep,
  PersonalStep,
  PlanStep,
  ScanningStep,
  WebsiteStep,
} from '../../components/onboarding/steps/OnboardingSteps'
import { useAuth } from '../../auth/AuthProvider'
import { requestScanWebsite } from '../../lib/fetchProduct'
import {
  ONBOARDING_STEPS,
  completeOnboarding,
  emptyOnboardingData,
  loadOnboarding,
  nextStep,
  prevStep,
  profileFromFetch,
  profileWithoutWebsite,
  saveOnboardingProgress,
  skipOnboarding,
  stepPath,
  syncNameFields,
  workspacePatchFromOnboarding,
  type OnboardingData,
  type OnboardingStepId,
} from '../../lib/onboarding'
import '../../onboarding.css'

function isStepId(value: string | undefined): value is OnboardingStepId {
  return Boolean(value && ONBOARDING_STEPS.includes(value as OnboardingStepId))
}

function normalizeUrl(raw: string) {
  const t = raw.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export default function OnboardingPage() {
  const { step: stepParam } = useParams()
  const step: OnboardingStepId = isStepId(stepParam) ? stepParam : 'personal'
  const navigate = useNavigate()
  const {
    user,
    loading,
    updateWorkspace,
    updateDisplayName,
    updatePlan,
    refreshOnboardingStatus,
  } = useAuth()
  const [data, setData] = useState<OnboardingData>(emptyOnboardingData())
  const [ready, setReady] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [marketInput, setMarketInput] = useState('')
  const [fontInput, setFontInput] = useState('')
  const [scanPct, setScanPct] = useState(0)
  const [scanDone, setScanDone] = useState(false)
  const [scanRetry, setScanRetry] = useState(0)
  const [scanStages, setScanStages] = useState<
    Array<{ id: string; label: string; status: string; message?: string }>
  >([])
  const [scanStats, setScanStats] = useState({
    pages: 0,
    products: 0,
    images: 0,
    colors: 0,
    fonts: 0,
  })
  const [scanPreview, setScanPreview] = useState<{
    logoUrl?: string
    imageUrls: string[]
    colors: string[]
    businessName?: string
  }>({ imageUrls: [], colors: [] })
  // Resume saved progress only on the first load — not when the user presses Back
  // to an earlier editable step (e.g. brand → website).
  const didResumeRef = useRef(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (loading) return
      if (!user) {
        if (alive) setReady(true)
        return
      }
      try {
        const state = await loadOnboarding(user.uid)
        if (!alive) return
        setCompleted(state.completed)
        const nameSeed =
          state.data.fullName ||
          user.displayName ||
          user.email?.split('@')[0] ||
          ''
        const parts = nameSeed.trim().split(/\s+/).filter(Boolean)
        setData({
          ...state.data,
          fullName: nameSeed,
          firstName: state.data.firstName || parts[0] || '',
          lastName: state.data.lastName || parts.slice(1).join(' '),
        })
        if (state.completed) return
        if (
          !didResumeRef.current &&
          (stepParam === 'personal' || stepParam === 'website' || !stepParam) &&
          state.step !== stepParam &&
          ONBOARDING_STEPS.includes(state.step)
        ) {
          didResumeRef.current = true
          navigate(stepPath(state.step), { replace: true })
        } else {
          didResumeRef.current = true
        }
      } finally {
        if (alive) setReady(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [user, loading, navigate, stepParam])

  // Scanning → brand confirm (progress driven by backend stages, not a timer)
  useEffect(() => {
    if (!ready || !user || completed || step !== 'scanning' || scanDone) return
    let alive = true
    const abort = new AbortController()
    setScanPct(0)
    setError(null)
    setScanStages([])
    setScanStats({ pages: 0, products: 0, images: 0, colors: 0, fonts: 0 })
    setScanPreview({ imageUrls: [], colors: [] })

    ;(async () => {
      const url = data.websiteUrl.trim()
      let nextData = { ...data }
      try {
        if (url) {
          const page = await requestScanWebsite(normalizeUrl(url), {
            signal: abort.signal,
            onProgress: (event) => {
              if (!alive) return
              setScanPct(Math.min(99, event.pct))
              setScanStages((prev) => {
                const next = [...prev]
                const idx = next.findIndex((s) => s.id === event.stageId)
                const row = {
                  id: event.stageId,
                  label: event.label,
                  status: event.status,
                  message: event.message,
                }
                if (idx >= 0) next[idx] = row
                else next.push(row)
                return next
              })
              if (event.stats) {
                setScanStats((prev) => ({
                  pages: event.stats?.pages ?? prev.pages,
                  products: event.stats?.products ?? prev.products,
                  images: event.stats?.images ?? prev.images,
                  colors: event.stats?.colors ?? prev.colors,
                  fonts: event.stats?.fonts ?? prev.fonts,
                }))
              }
              if (event.preview) {
                setScanPreview((prev) => ({
                  logoUrl: event.preview?.logoUrl || prev.logoUrl,
                  imageUrls: event.preview?.imageUrls?.length
                    ? event.preview.imageUrls.filter(Boolean)
                    : prev.imageUrls,
                  colors: event.preview?.colors?.length
                    ? event.preview.colors
                    : prev.colors,
                  businessName: event.preview?.businessName || prev.businessName,
                }))
              }
            },
          })
          if (!alive) return
          const fetched = profileFromFetch({
            url: page.url,
            title: page.title,
            description: page.description,
            images: page.images,
            category: page.category || data.category,
            logoUrl: page.logoUrl,
            colors: page.colors,
            fonts: page.fonts,
            markets: page.markets,
            audienceHint: page.audienceHint,
            products: page.products,
            brandVoice: page.brandVoice,
            styleNotes: page.styleNotes,
            brandKeywords: page.brandKeywords,
            colorDetails: page.colorDetails,
            fontDetails: page.fontDetails,
            brandProfile: page.brandProfile,
            extractionMethod: page.extractionMethod,
            extractionConfidence: page.extractionConfidence,
            paletteIncomplete: page.paletteIncomplete,
            completeBrandKit: page.completeBrandKit ?? undefined,
            // Keep AI polish failures in server logs only — don't surface in Review Brand.
            aiWarning: '',
          })
          nextData = {
            ...data,
            ...fetched,
            aiWarning: '',
            fullName: data.fullName,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            howHeard: data.howHeard,
            industry: fetched.industry || data.industry || '',
            category: fetched.category || data.category || '',
            sellType: data.sellType || fetched.sellType || 'physical',
            budget: data.budget,
            // Prefer freshly scanned name/logo over stale prior onboarding values
            businessName: fetched.businessName || data.businessName.trim() || '',
            logoUrl: fetched.logoUrl || data.logoUrl || '',
            goal: data.goal || 'sales',
            channels: data.channels,
            setupMode: 'scan',
          }
          const productCount = nextData.scannedProducts?.length || 0
          setScanStats({
            pages: 1,
            products: productCount,
            images: page.images.length,
            colors: nextData.brandColors?.length || 0,
            fonts: nextData.brandFonts?.length || 0,
          })
          setScanPreview({
            logoUrl: page.logoUrl || nextData.logoUrl,
            imageUrls: (page.images || []).slice(0, 4),
            colors: nextData.brandColors || [],
            businessName: nextData.businessName,
          })
        } else {
          nextData = {
            ...data,
            ...profileWithoutWebsite(data.fullName || data.businessName, {
              businessName: data.businessName,
              category: data.category,
              industry: data.industry,
              sellType: data.sellType || 'physical',
            }),
            fullName: data.fullName,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            howHeard: data.howHeard,
            budget: data.budget,
            setupMode: data.setupMode || 'manual',
          }
        }
        setData(nextData)
        await saveOnboardingProgress(user.uid, 'brand', nextData)
        if (!alive) return
        setScanPct(100)
        setScanDone(true)
        navigate(stepPath('brand'), { replace: true })
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'Could not read that website.')
        setScanPct((p) => Math.max(p, 8))
      }
    })()

    return () => {
      alive = false
      abort.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, completed, step, scanDone, scanRetry])

  if (loading || !ready) {
    return (
      <div className="ob-shell">
        <p className="ob-loading">Loading…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (completed) return <Navigate to="/app" replace />
  if (!isStepId(stepParam)) return <Navigate to={stepPath('personal')} replace />

  function patch(partial: Partial<OnboardingData>) {
    setData((prev) => {
      const next = { ...prev, ...partial }
      if ('firstName' in partial || 'lastName' in partial) return syncNameFields(next)
      return next
    })
  }

  async function finish(nextData: OnboardingData, skipped: boolean) {
    if (!user) return
    const synced = syncNameFields(nextData)
    if (synced.fullName.trim()) {
      try {
        await updateDisplayName(synced.fullName.trim())
      } catch {
        /* optional */
      }
    }
    // Persist brand kit onto workspace BEFORE marking onboarding complete —
    // generation flows read workspace via withBrandKit.
    await updateWorkspace(workspacePatchFromOnboarding(synced))
    try {
      const nextPlan =
        !skipped &&
        (synced.plan === 'starter' || synced.plan === 'growth' || synced.plan === 'pro')
          ? synced.plan
          : 'free'
      await updatePlan(nextPlan)
    } catch {
      /* plan write also happens in completeOnboarding */
    }
    if (skipped) await skipOnboarding(user.uid, synced)
    else await completeOnboarding(user.uid, synced)
    await refreshOnboardingStatus()
    navigate('/app', { replace: true })
  }

  async function startTrialAndLaunch() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      // Everyone starts on free (1 image trial). Paid plans require checkout.
      const synced = syncNameFields({ ...data, plan: 'free' })
      setData(synced)
      await finish(synced, false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start trial.')
      setSaving(false)
    }
  }

  async function launchWithFree() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const synced = syncNameFields({ ...data, plan: 'free' })
      setData(synced)
      await finish(synced, false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not launch.')
      setSaving(false)
    }
  }

  async function goNext() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      let synced = syncNameFields(data)
      setData(synced)
      if (step === 'plan') {
        await startTrialAndLaunch()
        return
      }

      // Manual business setup → brand kit (skip scan entirely)
      if (step === 'website' && synced.setupMode === 'manual') {
        synced = {
          ...synced,
          ...profileWithoutWebsite(synced.fullName || synced.businessName, {
            businessName: synced.businessName,
            category: synced.category,
            industry: synced.industry,
            sellType: synced.sellType || 'physical',
          }),
          fullName: synced.fullName,
          firstName: synced.firstName,
          lastName: synced.lastName,
          role: synced.role,
          howHeard: synced.howHeard,
          budget: synced.budget,
          goal: synced.goal || 'sales',
          channels: synced.channels,
          setupMode: 'manual',
          websiteUrl: '',
        }
        setData(synced)
        setScanDone(true)
        await saveOnboardingProgress(user.uid, 'brand', synced)
        navigate(stepPath('brand'))
        return
      }

      // Scan path → force setupMode and proceed to scanning
      if (step === 'website') {
        synced = { ...synced, setupMode: 'scan' }
        setData(synced)
        setScanDone(false)
      }

      const nxt = nextStep(step)
      if (!nxt) {
        await finish(synced, false)
        return
      }
      if (nxt === 'scanning') setScanDone(false)
      await saveOnboardingProgress(user.uid, nxt, synced)
      navigate(stepPath(nxt))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save progress.')
    } finally {
      setSaving(false)
    }
  }

  async function goBack() {
    const prev = prevStep(step)
    if (!prev || !user) return
    setSaving(true)
    try {
      // Persist the editable previous step so resume logic does not bounce
      // the user forward again (brand → website used to re-open as brand).
      await saveOnboardingProgress(user.uid, prev, syncNameFields(data))
      navigate(stepPath(prev))
    } finally {
      setSaving(false)
    }
  }

  async function onSaveExit() {
    if (!user) return
    setSkipping(true)
    try {
      await finish(syncNameFields(data), true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save and exit.')
      setSkipping(false)
    }
  }

  async function skipStep() {
    if (!user || step === 'scanning') return
    setSaving(true)
    setError(null)
    try {
      let synced = syncNameFields(data)
      // Skip website → jump past scanning to brand (no scan wait).
      const nxt = step === 'website' ? ('brand' as OnboardingStepId) : nextStep(step)
      if (step === 'website') {
        synced = {
          ...synced,
          ...profileWithoutWebsite(synced.fullName || synced.businessName, {
            businessName: synced.businessName,
            category: synced.category,
            industry: synced.industry,
            sellType: synced.sellType || '',
          }),
          websiteUrl: synced.websiteUrl,
          fullName: synced.fullName,
          firstName: synced.firstName,
          lastName: synced.lastName,
          role: synced.role,
          howHeard: synced.howHeard,
          budget: synced.budget,
          goal: synced.goal || 'sales',
          channels: synced.channels,
          setupMode: synced.setupMode || 'manual',
        }
        setData(synced)
        setScanDone(true)
      }
      if (!nxt || step === 'plan') {
        await launchWithFree()
        return
      }
      await saveOnboardingProgress(user.uid, nxt, synced)
      navigate(stepPath(nxt))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not skip.')
    } finally {
      setSaving(false)
    }
  }

  // Skip available on all steps except scanning (in-flight). Plan uses its own free-launch link.
  const canSkipStep =
    step === 'personal' || step === 'website' || step === 'brand' || step === 'goals'

  const ctaDisabled =
    saving ||
    skipping ||
    step === 'scanning' ||
    step === 'plan' ||
    (step === 'personal' &&
      (!(data.firstName.trim() || data.fullName.trim()) || !data.role)) ||
    (step === 'website' &&
      (data.setupMode === 'scan'
        ? !data.websiteUrl.trim()
        : data.setupMode === 'manual'
          ? !data.businessName.trim()
          : true)) ||
    (step === 'brand' && !(data.businessName.trim() && data.pitch.trim())) ||
    (step === 'goals' && data.channels.length === 0)

  const ctaLabel =
    step === 'website'
      ? data.setupMode === 'manual'
        ? 'Continue to brand'
        : data.setupMode === 'scan'
          ? 'Scan website'
          : 'Continue'
      : step === 'brand'
        ? 'Looks good'
        : step === 'goals'
          ? 'Continue to plans'
          : 'Continue'

  const hideFooter = step === 'scanning'
  const planFooter = step === 'plan'

  return (
    <OnboardingLayout
      step={step}
      hideFooter={hideFooter}
      onSaveExit={hideFooter ? undefined : () => void onSaveExit()}
      savingExit={skipping}
      footerLeft={
        prevStep(step) && !hideFooter ? (
          <button
            type="button"
            className="ob-back"
            onClick={() => void goBack()}
            disabled={saving || skipping}
          >
            Back
          </button>
        ) : (
          <span className="ob-footer-hint">About three minutes · Save and exit anytime</span>
        )
      }
      footerRight={
        hideFooter ? null : planFooter ? (
          <button
            type="button"
            className="ob-skip-step ob-plan-skip-free"
            disabled={saving || skipping}
            onClick={() => void launchWithFree()}
          >
            Skip for now, launch with free image trial
          </button>
        ) : (
          <div className="ob-footer-cta-row">
            {canSkipStep ? (
              <button
                type="button"
                className="ob-skip-step"
                disabled={saving || skipping}
                onClick={() => void skipStep()}
              >
                Skip
              </button>
            ) : null}
            <button
              type="button"
              className="ob-cta"
              disabled={ctaDisabled}
              onClick={() => void goNext()}
            >
              {saving ? 'Saving…' : ctaLabel}
              <span className="ob-cta-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </div>
        )
      }
    >
      {error && step !== 'scanning' ? (
        <p className="ob-error" role="alert">
          {error}
        </p>
      ) : null}

      {step === 'personal' ? <PersonalStep data={data} patch={patch} /> : null}
      {step === 'website' ? <WebsiteStep data={data} patch={patch} /> : null}
      {step === 'scanning' ? (
        <ScanningStep
          data={data}
          pct={scanPct}
          stats={scanStats}
          stages={scanStages}
          preview={scanPreview}
          error={error}
          onRetry={() => {
            setError(null)
            setScanDone(false)
            setScanRetry((n) => n + 1)
          }}
        />
      ) : null}
      {step === 'brand' ? (
        <BrandStep
          data={data}
          patch={patch}
          marketInput={marketInput}
          setMarketInput={setMarketInput}
          fontInput={fontInput}
          setFontInput={setFontInput}
        />
      ) : null}
      {step === 'goals' ? <GoalsStep data={data} patch={patch} /> : null}
      {step === 'plan' ? (
        <PlanStep
          data={data}
          patch={patch}
          busy={saving || skipping}
          onStartTrial={() => void startTrialAndLaunch()}
        />
      ) : null}
    </OnboardingLayout>
  )
}

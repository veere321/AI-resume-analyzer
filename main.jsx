import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import "./App.css";

const VITE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const HISTORY_KEY = "resume-analyzer-history-v1";

const defaultAnalysis = {
  title: "Ready to analyze",
  mode: "resume-only",
  overallScore: 0,
  atsScore: 0,
  jdMatchScore: null,
  summary: "Upload a resume to generate an ATS-style breakdown, role-fit score, and improvement plan.",
  strengths: [],
  matchedKeywords: [],
  missingKeywords: [],
  improvementAreas: [],
  formattingWarnings: [],
  sectionInsights: [],
  nextSteps: [],
  roleFitSummary: "No analysis has been run yet.",
  keywordClusters: [],
};

function readHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

const pageVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const blockVariants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

const liftHover = {
  y: -4,
  scale: 1.01,
  transition: { duration: 0.18, ease: "easeOut" },
};

const MotionDiv = motion.div;
const MotionSection = motion.section;
const MotionButton = motion.button;
const MotionArticle = motion.article;

function App() {
  const reduceMotion = useReducedMotion();
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [mode, setMode] = useState("jd-match");
  const [theme, setTheme] = useState(() => localStorage.getItem("resume-analyzer-theme") || "light");
  const [analysis, setAnalysis] = useState(defaultAnalysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [lastMeta, setLastMeta] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("resume-analyzer-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
  }, [history]);

  const hasAnalysis = useMemo(() => analysis && analysis.title !== defaultAnalysis.title, [analysis]);

  const saveToHistory = (nextAnalysis, meta, selectedFile, selectedMode, selectedJobDescription) => {
    const entry = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      fileName: selectedFile?.name || "Resume.pdf",
      mode: selectedMode,
      jobDescription: selectedJobDescription,
      meta,
      analysis: nextAnalysis,
    };

    setHistory((current) => [entry, ...current].slice(0, 12));
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please choose a PDF resume first.");
      return;
    }

    if (mode === "jd-match" && !jobDescription.trim()) {
      setError("Add a job description to compare against it, or switch to resume-only mode.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    formData.append("jobDescription", jobDescription);

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${VITE_BACKEND_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Analysis failed.");
      }

      setAnalysis({ ...defaultAnalysis, ...data.analysis });
      setLastMeta(data.meta);
      saveToHistory(data.analysis, data.meta, file, mode, jobDescription);
    } catch (requestError) {
      setError(requestError.message || "Could not connect to the analysis service.");
    } finally {
      setLoading(false);
    }
  };

  const resetApp = () => {
    setFile(null);
    setJobDescription("");
    setMode("jd-match");
    setAnalysis(defaultAnalysis);
    setError("");
    setLastMeta(null);
    setCopied(false);
  };

  const openHistoryItem = (item) => {
    setAnalysis(item.analysis);
    setMode(item.mode);
    setJobDescription(item.jobDescription || "");
    setLastMeta(item.meta);
    setError("");
  };

  const downloadReport = () => {
    const payload = {
      analysis,
      meta: lastMeta,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "resume-analysis-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(`${analysis.title}\n${analysis.roleFitSummary}\n\n${analysis.summary}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  };

  return (
    <MotionDiv
      className="app-shell"
      variants={pageVariants}
      initial={reduceMotion ? false : "hidden"}
      animate={reduceMotion ? false : "show"}
    >
      <MotionSection className="hero" variants={blockVariants}>
        <MotionDiv className="hero-copy" variants={blockVariants} whileHover={reduceMotion ? undefined : liftHover}>
          <div className="hero-topline">
            <span className="eyebrow">AI Resume Intelligence Platform</span>
            <MotionButton
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              {theme === "light" ? "Switch to dark" : "Switch to light"}
            </MotionButton>
          </div>
          <h1>Analyze resumes, compare against JDs, and surface actionable rewrite guidance.</h1>
          <p>
            A polished demo workspace for ATS scoring, keyword coverage, job-fit evaluation, improvement planning,
            and exportable analysis reports.
          </p>
          <div className="hero-points">
            <MotionDiv whileHover={reduceMotion ? undefined : liftHover}>
              <strong>2 modes</strong>
              <span>resume-only or JD-match</span>
            </MotionDiv>
            <MotionDiv whileHover={reduceMotion ? undefined : liftHover}>
              <strong>Structured output</strong>
              <span>scores, gaps, strengths, fixes</span>
            </MotionDiv>
            <MotionDiv whileHover={reduceMotion ? undefined : liftHover}>
              <strong>Demo history</strong>
              <span>save and revisit analyses locally</span>
            </MotionDiv>
          </div>
        </MotionDiv>

        <MotionDiv className="hero-panel" variants={blockVariants} whileHover={reduceMotion ? undefined : liftHover}>
          <div className="score-ring" style={{ ["--score"]: `${analysis.overallScore}%` }}>
            <div>
              <strong>{analysis.overallScore}</strong>
              <span>Overall score</span>
            </div>
          </div>
          <div className="hero-stat-grid">
            <div>
              <span>ATS</span>
              <strong>{analysis.atsScore}</strong>
            </div>
            <div>
              <span>JD match</span>
              <strong>{analysis.jdMatchScore ?? "-"}</strong>
            </div>
            <div>
              <span>History</span>
              <strong>{history.length}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{loading ? "Analyzing" : hasAnalysis ? "Ready" : "Idle"}</strong>
            </div>
          </div>
        </MotionDiv>
      </MotionSection>

      <section className="workspace">
        <MotionDiv className="panel form-panel" variants={blockVariants} whileHover={reduceMotion ? undefined : liftHover}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Input workspace</span>
              <h2>Upload a resume and choose your analysis mode.</h2>
            </div>
            <button className="ghost-button" type="button" onClick={resetApp}>
              Reset workspace
            </button>
          </div>

          <div className="mode-switch">
            <MotionButton type="button" className={mode === "jd-match" ? "mode-button active" : "mode-button"} onClick={() => setMode("jd-match")} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
              Resume + JD match
            </MotionButton>
            <MotionButton type="button" className={mode === "resume-only" ? "mode-button active" : "mode-button"} onClick={() => setMode("resume-only")} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
              Resume-only review
            </MotionButton>
          </div>

          <label className="upload-card">
            <span>Resume PDF</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files[0] || null)}
            />
            <p>{file ? file.name : "Drop in a PDF resume to start the analysis."}</p>
          </label>

          <label className="textarea-card">
            <div>
              <span>Job description</span>
              <small>Required for JD-match mode, optional for notes and future comparison flows.</small>
            </div>
            <textarea
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the JD here to compare responsibilities, skills, and must-have experience..."
              rows={9}
            />
          </label>

          {error ? <div className="alert error">{error}</div> : null}

          <div className="action-row">
            <MotionButton className="primary-button" type="button" onClick={handleUpload} disabled={loading} whileHover={reduceMotion ? undefined : { y: -2, scale: 1.01 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
              {loading ? "Analyzing resume..." : mode === "jd-match" ? "Run JD comparison" : "Run resume review"}
            </MotionButton>
            <MotionButton className="secondary-button" type="button" onClick={downloadReport} disabled={!hasAnalysis} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
              Download report JSON
            </MotionButton>
            <MotionButton className="secondary-button" type="button" onClick={copySummary} disabled={!hasAnalysis} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
              {copied ? "Copied" : "Copy summary"}
            </MotionButton>
          </div>
        </MotionDiv>

        <MotionDiv className="panel analysis-panel" variants={blockVariants} whileHover={reduceMotion ? undefined : liftHover}>
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">Analysis dashboard</span>
              <h2>{analysis.title}</h2>
            </div>
            <div className="status-pill">{lastMeta?.source || "Waiting for analysis"}</div>
          </div>

          <p className="summary-copy">{analysis.summary}</p>

          <div className="insight-grid">
            <MotionArticle className="info-card accent" whileHover={reduceMotion ? undefined : liftHover}>
              <span>Role fit</span>
              <strong>{analysis.roleFitSummary}</strong>
            </MotionArticle>
            <MotionArticle className="info-card" whileHover={reduceMotion ? undefined : liftHover}>
              <span>Matched keywords</span>
              <strong>{analysis.matchedKeywords?.length || 0}</strong>
            </MotionArticle>
            <MotionArticle className="info-card" whileHover={reduceMotion ? undefined : liftHover}>
              <span>Priority gaps</span>
              <strong>{analysis.missingKeywords?.length || 0}</strong>
            </MotionArticle>
            <MotionArticle className="info-card" whileHover={reduceMotion ? undefined : liftHover}>
              <span>Formatting warnings</span>
              <strong>{analysis.formattingWarnings?.length || 0}</strong>
            </MotionArticle>
          </div>

          <div className="progress-stack">
            <ProgressBar label="Overall score" value={analysis.overallScore} />
            <ProgressBar label="ATS readiness" value={analysis.atsScore} />
            <ProgressBar label="JD match" value={analysis.jdMatchScore ?? 0} muted={analysis.jdMatchScore == null} />
          </div>

          <div className="two-column-grid">
            <InsightCard title="Strengths" items={analysis.strengths} />
            <InsightCard title="Missing keywords" items={analysis.missingKeywords} />
            <InsightCard title="Improvement areas" items={analysis.improvementAreas} />
            <InsightCard title="Next steps" items={analysis.nextSteps} />
          </div>

          <div className="detail-grid">
            <InsightCard title="Formatting warnings" items={analysis.formattingWarnings} />
            <MotionDiv className="panel-internal" whileHover={reduceMotion ? undefined : { y: -3 }}>
              <h3>Section insights</h3>
              <div className="section-insights">
                {(analysis.sectionInsights || []).map((item) => (
                  <div key={`${item.section}-${item.status}`} className="section-row">
                    <div>
                      <strong>{item.section}</strong>
                      <p>{item.details}</p>
                    </div>
                    <span>{item.status}</span>
                  </div>
                ))}
              </div>
              <div className="keyword-clusters">
                {(analysis.keywordClusters || []).map((item) => (
                  <div key={item.label} className="cluster-pill">
                    <strong>{item.count}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </MotionDiv>
          </div>
        </MotionDiv>
      </section>

      <MotionSection className="panel history-panel" variants={blockVariants} whileHover={reduceMotion ? undefined : liftHover}>
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Local history</span>
            <h2>Recent analyses</h2>
          </div>
          <span className="muted-copy">Stored locally in this browser</span>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">
            <strong>No saved analyses yet.</strong>
            <p>Run a review to populate local history, then click any entry to reopen that report.</p>
          </div>
        ) : (
          <div className="history-grid">
            {history.map((item) => (
              <button key={item.id} type="button" className="history-card" onClick={() => openHistoryItem(item)}>
                <div>
                  <strong>{item.fileName}</strong>
                  <span>{item.mode === "jd-match" ? "JD match" : "Resume-only"}</span>
                </div>
                <p>{item.analysis?.roleFitSummary || "Open analysis"}</p>
                <small>
                  {formatDate(item.createdAt)} · Score {item.analysis?.overallScore ?? 0}
                </small>
              </button>
            ))}
          </div>
        )}
      </MotionSection>
    </MotionDiv>
  );
}

function ProgressBar({ label, value, muted = false }) {
  return (
    <div className="progress-card">
      <div className="progress-labels">
        <span>{label}</span>
        <strong>{muted ? "N/A" : `${value}%`}</strong>
      </div>
      <div className="progress-track">
        <span className={muted ? "progress-fill muted" : "progress-fill"} style={{ width: `${muted ? 0 : value}%` }} />
      </div>
    </div>
  );
}

function InsightCard({ title, items }) {
  return (
    <MotionDiv className="panel-internal" whileHover={{ y: -3 }} transition={{ duration: 0.18 }}>
      <h3>{title}</h3>
      {items && items.length > 0 ? (
        <ul className="bullet-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted-copy">No items available yet.</p>
      )}
    </MotionDiv>
  );
}

export default App;

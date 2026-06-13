require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const Groq = require("groq-sdk");

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

function normalizeText(value) {
    return String(value || "").trim();
}

function parseJsonFromModel(content) {
    if (!content) {
        return null;
    }

    const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i);
    const candidate = fencedMatch ? fencedMatch[1] : content;

    try {
        return JSON.parse(candidate);
    } catch (error) {
        const start = candidate.indexOf("{");
        const end = candidate.lastIndexOf("}");

        if (start !== -1 && end !== -1 && end > start) {
            try {
                return JSON.parse(candidate.slice(start, end + 1));
            } catch (nestedError) {
                return null;
            }
        }

        return null;
    }
}

function scoreFromText(text, keywords) {
    const lower = text.toLowerCase();
    const matches = keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
    return {
        matches,
        score: Math.min(100, Math.max(35, 40 + matches.length * 7)),
    };
}

function buildFallbackAnalysis(resumeText, jobDescription) {
    const resumeKeywords = [
        "react",
        "javascript",
        "typescript",
        "node",
        "express",
        "python",
        "sql",
        "aws",
        "html",
        "css",
        "leadership",
        "communication",
        "api",
        "testing",
        "project management",
    ];
    const jdKeywords = normalizeText(jobDescription)
        ? normalizeText(jobDescription)
            .split(/[^a-zA-Z0-9+.-]+/)
            .filter((item) => item.length > 3)
            .slice(0, 18)
        : [];
    const resumeScore = scoreFromText(resumeText, resumeKeywords);
    const jdScore = jdKeywords.length ? scoreFromText(resumeText, jdKeywords) : { matches: [], score: resumeScore.score };
    const overallScore = Math.round((resumeScore.score + jdScore.score) / 2);

    return {
        title: "Fallback analysis generated locally",
        mode: normalizeText(jobDescription) ? "jd-match" : "resume-only",
        overallScore,
        atsScore: overallScore,
        jdMatchScore: normalizeText(jobDescription) ? jdScore.score : null,
        summary:
            "The analysis service could not parse a structured AI response, so a local heuristic summary was generated. Review the highlighted gaps and rerun the analysis for a fresh AI pass.",
        strengths: resumeScore.matches.slice(0, 5).map((keyword) => `Mentions ${keyword}`),
        matchedKeywords: jdScore.matches,
        missingKeywords: jdKeywords.filter((keyword) => !resumeText.toLowerCase().includes(keyword.toLowerCase())).slice(0, 8),
        improvementAreas: [
            "Make role-specific achievements more measurable.",
            "Strengthen keyword coverage around the target role.",
            "Lead with impact, scope, and tools used in each project.",
        ],
        formattingWarnings: ["Add a sharper summary section", "Keep bullet points consistent", "Use quantifiable results where possible"],
        sectionInsights: [
            { section: "Summary", status: "Needs work", details: "Add a focused 2-3 line professional summary." },
            { section: "Experience", status: "Strong", details: "Project and work keywords are present in the resume text." },
            { section: "Keywords", status: normalizeText(jobDescription) ? "Partial match" : "Baseline match", details: "The document contains some relevant skills but could be more targeted." },
        ],
        nextSteps: [
            "Tailor the opening summary to the target role.",
            "Mirror the top 5 JD keywords naturally in experience bullets.",
            "Add measurable achievements and outcome metrics.",
        ],
        roleFitSummary: normalizeText(jobDescription)
            ? "The resume shows partial alignment with the target role, but it needs better keyword targeting and outcome-driven bullets."
            : "The resume contains enough signal for a general review, but it would benefit from stronger presentation and clearer impact.",
        keywordClusters: [
            { label: "Core skills", count: resumeScore.matches.length },
            { label: "Target fit", count: jdScore.matches.length },
            { label: "Priority gaps", count: Math.max(3, jdKeywords.length - jdScore.matches.length) },
        ],
    };
}

function buildPrompt({ resumeText, jobDescription }) {
    const hasJobDescription = Boolean(normalizeText(jobDescription));

    return [
        {
            role: "system",
            content:
                "You are an expert resume strategist and ATS reviewer. Return only valid JSON with no markdown fences, no code block, and no extra commentary. Use concise but actionable language.",
        },
        {
            role: "user",
            content: hasJobDescription
                ? `Analyze the resume against the job description and return JSON with these keys: title, mode, overallScore, atsScore, jdMatchScore, summary, strengths, matchedKeywords, missingKeywords, improvementAreas, formattingWarnings, sectionInsights, nextSteps, roleFitSummary, keywordClusters.

Rules:
- overallScore and atsScore must be integers from 0 to 100.
- jdMatchScore must be an integer from 0 to 100.
- strengths, matchedKeywords, missingKeywords, improvementAreas, formattingWarnings, nextSteps should be arrays of short strings.
- sectionInsights should be an array of objects with section, status, and details.
- keywordClusters should be an array of objects with label and count.
- Focus on practical rewrite guidance and ATS optimization.

Resume:
${resumeText}

Job Description:
${normalizeText(jobDescription)}`
                : `Analyze the resume without a job description and return JSON with these keys: title, mode, overallScore, atsScore, jdMatchScore, summary, strengths, matchedKeywords, missingKeywords, improvementAreas, formattingWarnings, sectionInsights, nextSteps, roleFitSummary, keywordClusters.

Rules:
- overallScore and atsScore must be integers from 0 to 100.
- jdMatchScore must be null when no job description is provided.
- strengths, improvementAreas, formattingWarnings, nextSteps should be arrays of short strings.
- sectionInsights should be an array of objects with section, status, and details.
- keywordClusters should be an array of objects with label and count.
- Focus on resume quality, impact, ATS readiness, and rewrite guidance.

Resume:
${resumeText}`,
        },
    ];
}

app.post("/analyze", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "No file uploaded" });
        }

        if (req.file.mimetype !== "application/pdf") {
            return res.status(400).json({ success: false, error: "Please upload a PDF resume." });
        }

        const jobDescription = normalizeText(req.body.jobDescription);
        const mode = normalizeText(req.body.mode) === "jd-match" && jobDescription ? "jd-match" : "resume-only";

        const data = await pdfParse(req.file.buffer);
        const resumeText = normalizeText(data.text);

        if (!resumeText) {
            return res.status(400).json({ success: false, error: "Unable to extract text from the uploaded PDF." });
        }

        const messages = buildPrompt({ resumeText, jobDescription: mode === "jd-match" ? jobDescription : "" });

        const chatCompletion = await groq.chat.completions.create({
            messages,
            model: MODEL,
            temperature: 0.3,
        });

        const aiResponse = chatCompletion.choices[0]?.message?.content || "";
        const parsedResponse = parseJsonFromModel(aiResponse);
        const analysis = parsedResponse || buildFallbackAnalysis(resumeText, mode === "jd-match" ? jobDescription : "");

        res.json({
            success: true,
            analysis,
            meta: {
                fileName: req.file.originalname,
                mode,
                resumeLength: resumeText.length,
                jobDescriptionLength: jobDescription.length,
                model: MODEL,
                source: parsedResponse ? "groq" : "fallback",
            },
        });
    } catch (error) {
        console.error("Analysis error:", error);

        res.status(500).json({
            success: false,
            error: "AI analysis failed. Please try again.",
        });
    }
});

app.get("/health", (_req, res) => {
    res.json({ success: true, status: "ok" });
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port} (Groq model: ${MODEL})`);
});

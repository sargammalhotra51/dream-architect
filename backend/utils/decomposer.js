// // backend/utils/decomposer.js
// function estimateEffort(goalText) {
//   const text = String(goalText || '').toLowerCase();
//   if (text.includes('beginner') || text.includes('basic') || text.includes('intro')) return 40;
//   if (text.includes('job') || text.includes('frontend') || text.includes('full-stack')) return 400;
//   return 120; // default medium
// }

// function addDays(date, days) {
//   const d = new Date(date);
//   d.setDate(d.getDate() + days);
//   return d;
// }

// /**
//  * decomposeGoal({ title, targetDate, hoursPerWeek })
//  * Returns { estimatedEffort, achievableHours, milestones: [...] }
//  */
// const OpenAI = require("openai");
// const client = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
//   baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
// });

// async function decomposeGoal({ title, targetDate, hoursPerWeek }) {
//   const prompt = `
//   You are a career planning assistant. Break down the goal "${title}" into 4–6 milestones with realistic timelines and tasks.
//   Assume the user can dedicate ${hoursPerWeek} hours per week until ${targetDate}.
  
//   For each milestone, provide:
//   - Milestone title
//   - Target date (approximate)
//   - 3–5 tasks (each with estimated hours)
  
//   Return a structured JSON object like:
//   {
//     "estimated_effort_hours": 300,
//     "achievable_hours": 200,
//     "weeks_available": 20,
//     "milestones": [
//       {
//         "title": "Milestone 1 title",
//         "target_date": "YYYY-MM-DD",
//         "tasks": [
//           {"title": "Task 1", "estimated_hours": 10},
//           {"title": "Task 2", "estimated_hours": 8}
//         ]
//       }
//     ]
//   }
//   `;

//   const response = await client.chat.completions.create({
//     model: "gpt-4o-mini",
//     messages: [{ role: "user", content: prompt }],
//     temperature: 0.7,
//   });

//   try {
//     const json = JSON.parse(response.choices[0].message.content);
//     return json;
//   } catch (e) {
//     console.error("Failed to parse AI output", e);
//     return { milestones: [] };
//   }
// }

// module.exports = { decomposeGoal };


// backend/utils/decomposer.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


const MODEL_NAME = process.env.GENAI_MODEL || "models/gemini-2.5-flash";
const model = genAI.getGenerativeModel({ model: MODEL_NAME });
console.log(`Using Gemini model: ${MODEL_NAME}`);



function calculateWeeks(targetDate) {
  const diff = (new Date(targetDate) - new Date()) / (1000 * 60 * 60 * 24 * 7);
  return Math.max(Math.floor(diff), 4);
}

// --- Domain-specific templates for fallback ---
function getGoalTemplate(goal) {
  const g = goal.toLowerCase();

  if (g.includes("frontend"))
    return [
      "HTML, CSS & responsive design",
      "JavaScript fundamentals",
      "React.js and frontend frameworks",
      "Version control and hosting",
    ];

  if (g.includes("backend"))
    return [
      "Programming fundamentals (Node.js, Python)",
      "Databases & SQL",
      "Building REST APIs",
      "Authentication, testing, and deployment",
    ];

  if (g.includes("youtube") || g.includes("content"))
    return [
      "Define your niche and audience",
      "Learn video production and editing",
      "Create and publish your first videos",
      "Optimize for growth and engagement",
      "Monetize and build your brand",
    ];

  if (g.includes("ai") || g.includes("ml") || g.includes("data"))
    return [
      "Learn Python & math fundamentals",
      "Data preprocessing and visualization",
      "Machine learning with Scikit-learn",
      "Deep learning and neural networks",
      "ML project deployment and optimization",
    ];

  if (g.includes("fitness") || g.includes("health"))
    return [
      "Assess fitness level and set goals",
      "Learn workout fundamentals",
      "Track nutrition and sleep",
      "Progressive overload and habit building",
    ];

  // Default fallback for other roles
  return [
    "Understand fundamentals of the domain",
    "Study key tools and technologies",
    "Apply learning through projects",
    "Refine, iterate, and grow expertise",
  ];
}

// --- Main Function ---
async function decomposeGoal({ title, targetDate, hoursPerWeek }) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const weeks = calculateWeeks(targetDate);
  const achievableHours = weeks * hoursPerWeek;

  //Try Gemini First
  const prompt = `
  You are a structured roadmap planner.
  The user wants to achieve the goal: "${title}".
  They can dedicate ${hoursPerWeek} hours per week for ${weeks} weeks (until ${targetDate}).

  Break this goal into 4-6 milestones with progressive skill development and time-bound tasks.
  Each milestone should:
  - Have a descriptive title
  - Contain 3-5 specific, realistic tasks with estimated hours
  - Include start_date and target_date fields
  - Be relevant and ordered logically

  Return a *valid JSON* strictly in this format:
  {
    "estimated_effort_hours": <number>,
    "achievable_hours": ${achievableHours},
    "weeks_available": ${weeks},
    "milestones": [
      {
        "title": "Milestone 1: ...",
        "start_date": "YYYY-MM-DD",
        "target_date": "YYYY-MM-DD",
        "tasks": [
          {"title": "Task 1", "estimated_hours": <number>},
          {"title": "Task 2", "estimated_hours": <number>}
        ]
      }
    ]
  }
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonStr = text.slice(start, end + 1);

    const plan = JSON.parse(jsonStr);

    // Validate the AI response
    if (
      plan &&
      Array.isArray(plan.milestones) &&
      plan.milestones.length > 0 &&
      plan.milestones[0].title
    ) {
      // Ensure base numeric fields always exist first
  plan.achievable_hours = plan.achievable_hours || achievableHours || 0;
  plan.weeks_available = plan.weeks_available || weeks || 0;

  // Calculate estimated effort safely
  if (
    typeof plan.achievable_hours === "number" &&
    typeof plan.weeks_available === "number"
  ) {
    plan.estimated_effort_hours =
      plan.achievable_hours * plan.weeks_available;
  } else {
    // fallback if AI sent text instead of numbers
    plan.estimated_effort_hours = achievableHours * weeks;
  }

  // Log to confirm in backend
  console.log("Estimated Effort:", plan.estimated_effort_hours);


      // Ensure every milestone has valid tasks + dates
      plan.milestones = plan.milestones.map((m, i) => ({
        title: m.title || `Milestone ${i + 1}`,
        start_date:
          m.start_date ||
          new Date(Date.now() + i * 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        target_date:
          m.target_date ||
          new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        tasks:
          Array.isArray(m.tasks) && m.tasks.length > 0
            ? m.tasks
            : [
                {
                  title: `Research about ${title}`,
                  estimated_hours: 8,
                },
                {
                  title: `Practical task for ${title}`,
                  estimated_hours: 6,
                },
              ],
      }));

      console.log("Gemini roadmap generated successfully");
      return plan;
    }

    // If AI output was empty or invalid, go to fallback
    throw new Error("AI output invalid or incomplete");
  } catch (err) {
    console.warn("⚠️ Gemini failed, generating fallback roadmap:", err.message);

    //Generate Fallback (only if AI fails)
    const baseStages = getGoalTemplate(title);
    return {
      estimated_effort_hours: achievableHours * 1.2,
      achievable_hours: achievableHours,
      weeks_available: weeks,
      milestones: baseStages.map((stage, i) => ({
        title: `Milestone ${i + 1}: ${stage}`,
        start_date: new Date(
          Date.now() + i * 7 * 24 * 60 * 60 * 1000
        ).toISOString().split("T")[0],
        target_date: new Date(
          Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000
        ).toISOString().split("T")[0],
        tasks: [
          { title: `Learn and research: ${stage}`, estimated_hours: 8 },
          { title: `Practice or implement: ${stage}`, estimated_hours: 6 },
        ],
      })),
    };
  }
}

module.exports = { decomposeGoal };






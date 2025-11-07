// frontend/script.js

const targetDateInput = document.getElementById("targetDate");
const today = new Date().toISOString().split("T")[0];
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0];
targetDateInput.min = today;
targetDateInput.value = nextWeek;


const form = document.getElementById('goalForm');
const planArea = document.getElementById('planArea');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  planArea.innerHTML = '<div class="p-4 bg-white rounded shadow">Generating plan...</div>';

  const title = document.getElementById('title').value.trim();
  const targetDate = document.getElementById('targetDate').value;
  const hoursPerWeek = parseInt(document.getElementById('hoursPerWeek').value, 10) || 5;
  const description = document.getElementById('description').value.trim();

  try {
    const res = await fetch('http://localhost:4000/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, targetDate, hoursPerWeek })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Server error');
    }

    const data = await res.json();
    displayPlan(data);
  } catch (err) {
    planArea.innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded">Error: ${err.message}</div>`;
    console.error(err);
  }
});

function displayPlan(data) {
  const { milestones, achievable_hours, weeks_available } = data;

 
  const achievable = achievable_hours || 0;
  const weeks = weeks_available || 0;

  let html = `
    <div class="bg-white p-4 rounded shadow mb-4">
      <div class="flex justify-between items-center mb-2">
        <div>
          <h2 class="text-lg font-semibold">Generated Plan</h2>
          <p class="text-sm text-gray-600">
            Achievable: ${achievable} hrs • Weeks available: ${weeks}
          </p>
        </div>
      </div>
    </div>
  `;

  milestones.forEach((m, i) => {
    html += `
      <div class="bg-white p-4 rounded shadow mb-4">
        <div class="flex justify-between items-center mb-2">
          <h3 class="font-semibold">${escapeHtml(m.title)}</h3>

          </div>
          <div class="text-sm text-gray-600">${m.start_date} → ${m.target_date || m.end_date || ''}</div>
        <ul class="list-disc pl-6 text-gray-700">
          ${Array.isArray(m.tasks)
            ? m.tasks
                .map(
                  (t) =>
                    `<li>${escapeHtml(t.title)} — ${t.estimated_hours || 0} hrs</li>`
                )
                .join('')
            : '<li>No tasks available</li>'
          }
        </ul>
      </div>
    `;
  });

  planArea.innerHTML = html + `
  <div class="text-center mt-6">
    <button id="downloadBtn" 
      class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow transition">
      Download the plan!
    </button>
  </div>
`;
}

// PDF download feature
document.addEventListener("click", async (e) => {
  if (e.target.id === "downloadBtn") {
    const planElement = document.getElementById("planArea");
    

    
    if (typeof window.jspdf === "undefined") {
      alert("Please wait, PDF generator is loading...");
    }

    // Capture the plan area
    const canvas = await html2canvas(planElement, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jspdf.jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pageWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pdfHeight);
    pdf.save("DreamArchitect_Plan.pdf");
  }
});


// Utility to sanitize text
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}

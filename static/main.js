// main.js

// Tab switching functionality
function openTab(evt, tabName) {
    // Hide all tab content
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }

    // Deactivate all tab links
    const tabLinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].classList.remove("active");
    }

    // Show selected tab and activate link
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

// Combined DOMContentLoaded handler for all page initialization
document.addEventListener("DOMContentLoaded", () => {
    // Initialize tabs on about page
    if (document.querySelector('.tab-container')) {
        // Set Arabic as default active tab
        document.getElementById('arabic').classList.add('active');
        document.querySelector('[onclick*="arabic"]').classList.add('active');
    }
    // Theme initialization
    const currentTheme = localStorage.getItem("theme") || "light";
    const isDarkMode = currentTheme === "dark";
    document.body.classList.toggle("dark-mode", isDarkMode);

    // Chatbot initialization
    const chatbotContainer = document.getElementById('chatbot-container');
    const chatbotToggle = document.getElementById('chatbot-toggle');
    const chatbotClose = document.getElementById('chatbot-close');
    const chatbotMessages = document.getElementById('chatbot-messages');
    const chatbotInput = document.getElementById('chatbot-input');
    const chatbotSend = document.getElementById('chatbot-send');
    
    // Apply theme classes to chatbot toggle
    if (chatbotToggle) {
        chatbotToggle.classList.toggle('dark-mode', isDarkMode);
        chatbotToggle.classList.toggle('light-mode', !isDarkMode);
    }

    // Set initial chatbot state
    chatbotContainer.style.display = 'none';
    chatbotContainer.style.right = window.innerWidth <= 480 ? '-100%' : '-280px';
    chatbotToggle.style.display = 'flex';

    // Chat toggle button: open the chat window
    chatbotToggle.addEventListener('click', () => {
        const isMobile = window.innerWidth <= 480;
        chatbotContainer.style.display = 'flex';
        chatbotContainer.classList.add('visible');
        chatbotContainer.style.right = isMobile ? '0' : '20px';
        chatbotToggle.style.display = 'none';
    });

    // Chat close button: close the chat window
    chatbotClose.addEventListener('click', (e) => {
        e.stopPropagation();
        const isMobile = window.innerWidth <= 480;
        chatbotContainer.classList.remove('visible');
        chatbotContainer.style.right = isMobile ? '-100%' : '-280px';
        setTimeout(() => {
            chatbotContainer.style.display = 'none';
            chatbotToggle.style.display = 'flex';
        }, 300);
    });

    // Message handling
    chatbotSend.addEventListener('click', async () => {
        const userQuery = chatbotInput.value.trim();
        if (!userQuery) return;
        appendMessage('user', userQuery);
        chatbotInput.value = '';

        const latestAnalysis = localStorage.getItem("latestAnalysis") || "";
        showTypingIndicator();
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: userQuery, analysis: latestAnalysis }),
            });
            removeTypingIndicator();
            if (!response.ok) throw new Error('Failed to fetch chatbot response');
            
            const data = await response.json();
            appendMessage('bot', data.response || 'Sorry, I could not understand your question.');
        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator();
            appendMessage('bot', 'An error occurred while processing your request.');
        }
    });

    // Allow pressing Enter to send a message
    chatbotInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') chatbotSend.click();
    });

    // Shared initialization logic
    loadChatHistory();
    adjustChatbotSize();
    adjustTableLayout();
});

// Dark Mode Toggle Function with Persistence
function toggleDarkMode() {
    const body = document.body;
    const isDarkMode = body.classList.toggle('dark-mode');
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    showToast(isDarkMode ? "Dark Mode Enabled" : "Light Mode Enabled", "info");
    
    // Update chatbot container and toggle button styles for dark mode
    const chatbotContainer = document.getElementById('chatbot-container');
    const chatbotToggle = document.getElementById('chatbot-toggle');
    if (chatbotContainer) {
        chatbotContainer.classList.toggle('dark-mode');
    }
    if (chatbotToggle) {
        // Use CSS classes instead of inline styles for theme consistency
        chatbotToggle.classList.toggle('dark-mode', isDarkMode);
        chatbotToggle.classList.toggle('light-mode', !isDarkMode);
    }
}
  
// Show spinner overlay with custom message
function showSpinner(message) {
    const spinnerOverlay = document.getElementById("spinnerOverlay");
    const spinnerMessage = document.getElementById("spinnerMessage");
    spinnerMessage.innerText = message;
    spinnerOverlay.style.display = "block";
}
  
// Hide spinner overlay
function hideSpinner() {
    const spinnerOverlay = document.getElementById("spinnerOverlay");
    spinnerOverlay.style.display = "none";
}
  
// File input handling
const fileInput = document.getElementById('csvFile');
const uploadBox = document.querySelector('.upload-box');
const selectedFileDiv = document.getElementById('selectedFile');
  
if (fileInput) {
    fileInput.addEventListener('change', async (event) => {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            // Show selected file name
            selectedFileDiv.textContent = `Selected: ${file.name}`;
            selectedFileDiv.classList.add('show');
            
            // Auto-upload the file
            await uploadCSV();
        }
    });
  
    // Add click handler for the upload box
    if (uploadBox) {
        uploadBox.addEventListener('click', () => {
            fileInput.click();
        });
    }
} else {
    console.error('File input element is missing.');
}
  
// Function to upload the CSV file with spinner and toast notifications
async function uploadCSV() {
    const fileInput = document.getElementById("csvFile");
    if (!fileInput.files[0]) {
        showToast("Please select a CSV file first!", "error");
        return;
    }
    setStep(1);
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
  
    showSpinner("Uploading CSV...");
  
    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });
  
        const data = await response.json();
  
        if (!response.ok) {
            throw new Error(data.error || response.statusText);
        }
  
        const requests = data.requests;
        if (!requests || requests.length === 0) {
            throw new Error("No rows found in the CSV.");
        }
  
        // Populate dropdown with request titles
        const dropdown = document.getElementById("requestDropdown");
        dropdown.innerHTML = "";
        requests.forEach(req => {
            const option = document.createElement("option");
            option.value = req.index;
            option.text = `Row ${req.index} - ${req.title}`;
            dropdown.add(option);
        });
  
        setStep(2);
        // Smooth scroll to the request selection section
        document.getElementById("requestSelector").style.display = "block";
        document.getElementById("requestSelector").scrollIntoView({ behavior: "smooth" });
        showToast("CSV uploaded successfully", "success");
    } catch (error) {
        showToast(`Upload failed: ${error.message}`, "error");
        console.error("Upload failed: ", error.message);
    } finally {
        hideSpinner();
    }
}
  
// Function to preview the selected CSV row with spinner and toast notifications
async function previewSelectedRequest() {
    const dropdown = document.getElementById("requestDropdown");
    const rowIndex = dropdown.value;
    if (!rowIndex) {
        showToast("No request selected.", "error");
        return;
    }
  
    showSpinner("Loading preview...");
  
    try {
        const response = await fetch(`/preview_request/${rowIndex}`);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
  
        const rowData = await response.json();
        let html = "<table id='previewTable' border='1'><tr><th>Field</th><th>Value</th></tr>";
        for (const key in rowData) {
            html += `<tr><td>${key}</td><td>${rowData[key]}</td></tr>`;
        }
        html += "</table>";
        document.getElementById("previewResults").innerHTML = html;
        showToast("Preview loaded", "success");
    } catch (error) {
        showToast(`Error: ${error.message}`, "error");
    } finally {
        hideSpinner();
    }
}
  
// Function to retrieve AI-generated analysis with spinner and toast notifications
async function getSingleAnalysis() {
    const dropdown = document.getElementById("requestDropdown");
    const rowIndex = dropdown.value;
    if (!rowIndex) {
        showToast("No request selected.", "error");
        return;
    }
  
    showSpinner("Retrieving analysis, please wait...");
  
    try {
        const response = await fetch(`/prioritize/${rowIndex}`, { method: "GET" });
        if (!response.ok) {
            throw new Error(response.statusText);
        }
  
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
  
        // Convert Markdown output to HTML using marked.js
        const markdown = data.analysis;
        console.log("Raw Markdown Received:", markdown); // Log the raw markdown
        // Save the latest analysis into LocalStorage for multi-user / persistent usage.
        localStorage.setItem("latestAnalysis", markdown);
  
        let htmlAnalysis = ''; // Initialize
        try {
            htmlAnalysis = marked.parse(markdown);
            console.log("HTML generated by marked.parse():", htmlAnalysis); // Log the generated HTML
        } catch (markedError) {
            console.error("Error during marked.parse():", markedError); // Log any parsing errors
            htmlAnalysis = `<p style="color: red;">Error rendering Markdown: ${markedError.message}</p><pre>${markdown}</pre>`; // Display error and raw markdown on failure
        }
        setStep(3);
        let resultHTML = `<h3>Analysis for Row ${data.index}: ${data.title}</h3>`;
        resultHTML += `<h4>Directorate: ${data.directorate}</h4>`;
        resultHTML += htmlAnalysis;
        resultHTML += `<div style="margin-top:20px;">
                         <button onclick="downloadReport()">Download Report as PDF</button>
                         <button onclick="copyReport()">Copy Report</button>
                         <button onclick="emailReport()">Email Report</button>
                       </div>`;
        document.getElementById("results").innerHTML = resultHTML;
  
        applyHeatMapStyling();
        document.getElementById("evaluatorField").style.display = "block";
        // Smooth scroll to the results section once analysis is complete
        document.getElementById("resultsWrapper").scrollIntoView({ behavior: "smooth" });
        showToast("Analysis retrieved successfully", "success");
    } catch (error) {
        showToast(`Error: ${error.message}`, "error");
    } finally {
        hideSpinner();
    }
}
  
// Function to apply heat map styling to rating cells in the analysis table
function applyHeatMapStyling() {
    const resultDiv = document.getElementById("results");
    const table = resultDiv.querySelector("table");
    if (!table) return;
    const rows = table.getElementsByTagName("tr");
    for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName("td");
        if (cells.length < 2) continue;
        const ratingCell = cells[1];
        const ratingText = ratingCell.textContent.trim().toLowerCase();
        let className = "";
        if (ratingText.includes("very high")) className = "rating-very-high";
        else if (ratingText.includes("high")) className = "rating-high";
        else if (ratingText.includes("medium")) className = "rating-medium";
        else if (ratingText.includes("low") && !ratingText.includes("very low")) className = "rating-low";
        else if (ratingText.includes("very low")) className = "rating-very-low";
        if (className) {
            ratingCell.innerHTML = `<span class="${className}">${ratingCell.textContent.trim()}</span>`;
        }
    }
}
  
// Function that inserts the evaluator's name into the report
function addEvaluatorName() {
    const name = document.getElementById("reportEvaluatorName").value.trim();
    if (!name) {
        showToast("Please enter a name.", "error");
        return;
    }
    const resultsDiv = document.getElementById("results");
    if (!document.getElementById("nameHeading")) {
        const headingEl = document.createElement("h4");
        headingEl.id = "nameHeading";
        headingEl.style.marginTop = "10px";
        resultsDiv.insertBefore(headingEl, resultsDiv.firstChild);
    }
    document.getElementById("nameHeading").innerText = `Evaluator: ${name}`;
    showToast("Name added to report", "success");
}
  
// Updated setStep function to work with the enhanced step wizard and update the progress smoothly
function setStep(stepNumber) {
    const steps = document.querySelectorAll(".step-wizard .step");
    steps.forEach((step, index) => {
        if (index === stepNumber - 1) {
            step.classList.add("active");
        } else {
            step.classList.remove("active");
        }
    });
    const progressIndicator = document.getElementById("progress-indicator");
    if (progressIndicator) {
        const percent = (stepNumber / steps.length) * 100;
        progressIndicator.style.width = `${percent}%`;
    }
}
  
// Toast Notification function
function showToast(message, type) {
    const toastContainer = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;
    toastContainer.appendChild(toast);
  
    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toastContainer.removeChild(toast), 500);
    }, 3000);
}
  
// Function to download the analysis report as a PDF file using html2pdf.js
function downloadReport() {
    const element = document.getElementById("resultsWrapper");
    const opt = {
        margin: 0.5,
        filename: 'analysis_report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

// Function to email the analysis report
async function emailReport() {
    const email = prompt("Enter email address to send the report to:");
    if (!email || !email.includes('@')) {
        showToast("Please enter a valid email address", "error");
        return;
    }
    
    showSpinner("Generating PDF...");
    
    try {
        // Generate PDF and get as base64 string
        const element = document.getElementById("resultsWrapper");
        const pdfDataUri = await html2pdf().from(element).output('datauristring');
        // Extract just the base64 data part
        const pdfBase64 = pdfDataUri.split(',')[1];
        
        showSpinner("Sending email...");
        
        const response = await fetch('/send-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                email: email,
                pdf: pdfBase64
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send email');
        }
        
        const data = await response.json();
        showToast(data.message, 'success');
    } catch (error) {
        console.error('Error:', error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        hideSpinner();
    }
}
  
// Function to copy the analysis text to clipboard
function copyReport() {
    const reportText = document.getElementById("resultsWrapper").innerText;
    navigator.clipboard.writeText(reportText).then(() => {
        showToast("Report copied to clipboard", "success");
    }).catch(() => {
        showToast("Copy failed", "error");
    });
}

// Function to clear the analysis cache on the server
async function clearAnalysisCache() {
    showSpinner("Clearing analysis cache...");
    
    try {
        const response = await fetch('/analysis/clear', { method: 'POST' });
        if (!response.ok) {
            throw new Error('Failed to clear analysis cache');
        }
        const data = await response.json();
        showToast(data.message, 'success');
    } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred while clearing analysis cache', 'error');
    } finally {
        hideSpinner();
    }
}
  
// Function to adjust chatbot size based on window size
function adjustChatbotSize() {
    const chatbot = document.getElementById('chatbot-container');
    if (!chatbot) return;
    const windowWidth = window.innerWidth;
    if (windowWidth <= 480) {
        chatbot.style.width = '100%';
        chatbot.style.maxHeight = '80vh';
        chatbot.style.right = '0';
        chatbot.style.bottom = '0';
        chatbot.style.borderRadius = '15px 15px 0 0';
    } else {
        chatbot.style.width = '320px';
        chatbot.style.maxHeight = '500px';
        chatbot.style.right = '20px';
        chatbot.style.bottom = '20px';
        chatbot.style.borderRadius = '15px';
    }
}
  
// Function to adjust table layout for better mobile viewing
function adjustTableLayout() {
    const tables = document.querySelectorAll('table');
    const windowWidth = window.innerWidth;
    tables.forEach(table => {
        if (windowWidth <= 768) {
            table.classList.add('table-responsive');
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
            table.querySelectorAll('tbody tr').forEach(row => {
                row.querySelectorAll('td').forEach((cell, index) => {
                    cell.setAttribute('data-label', headers[index]);
                });
            });
        } else {
            table.classList.remove('table-responsive');
        }
    });
}
  
// Debounce function to limit resize event calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
  
// Clear chat history
async function clearChatHistory() {
    try {
        const response = await fetch('/chat/clear', { method: 'POST' });
        if (!response.ok) {
            throw new Error('Failed to clear chat history');
        }
        const data = await response.json();
        showToast(data.message, 'success');
        const chatbotMessages = document.getElementById('chatbot-messages');
        chatbotMessages.innerHTML = '';
        localStorage.removeItem('chatbotHistory');
    } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred while clearing chat history', 'error');
    }
}
  
// Chat history functions
function loadChatHistory() {
    const history = JSON.parse(localStorage.getItem('chatbotHistory')) || [];
    history.forEach(({ sender, message, timestamp }) => {
        appendMessage(sender, message, timestamp, false);
    });
}
  
function saveChatHistory(sender, message, timestamp) {
    const history = JSON.parse(localStorage.getItem('chatbotHistory')) || [];
    history.push({ sender, message, timestamp });
    localStorage.setItem('chatbotHistory', JSON.stringify(history));
}
  
function appendMessage(sender, message, timestamp = new Date().toLocaleTimeString(), save = true) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chatbot-message', sender);
    const messageContent = document.createElement('span');
    messageContent.textContent = message;
    const messageTimestamp = document.createElement('span');
    messageTimestamp.classList.add('chatbot-timestamp');
    messageTimestamp.textContent = timestamp;
    messageElement.appendChild(messageContent);
    messageElement.appendChild(messageTimestamp);
    const chatbotMessages = document.getElementById('chatbot-messages');
    chatbotMessages.appendChild(messageElement);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    if (save) saveChatHistory(sender, message, timestamp);
}
  
function showTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typing-indicator';
    typingIndicator.innerHTML = '<i class="bi bi-robot animated-robot"></i>';
    const chatbotMessages = document.getElementById('chatbot-messages');
    chatbotMessages.appendChild(typingIndicator);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}
  
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) typingIndicator.remove();
}
  
// Resize event listener for adjustments
window.addEventListener('resize', debounce(() => {
    adjustChatbotSize();
    adjustTableLayout();
}, 250));

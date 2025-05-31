// static/main.js

// ==========================================================================
// Constants
// ==========================================================================

// API_KEY is expected to be defined globally by an inline script in the HTML (e.g., index.html)
// For pages where it's not defined (e.g., about.html), API_KEY will be undefined.
// Functions in this script that use API_KEY must be aware of this if used on such pages.

const FADE_DURATION = 300; // ms
const TOAST_DURATION = 3000; // ms
const TOAST_FADE_OUT_DURATION = 500; // ms
const MOBILE_BREAKPOINT = 480; // px
const TABLET_BREAKPOINT = 768; // px
const CHATBOT_DESKTOP_WIDTH_STR = '320px';
const CHATBOT_DESKTOP_RIGHT_VISIBLE_STR = '20px';
const CHATBOT_DESKTOP_RIGHT_HIDDEN_STR = '-280px';
const CHATBOT_MOBILE_RIGHT_VISIBLE_STR = '0';
const CHATBOT_MOBILE_RIGHT_HIDDEN_STR = '-100%';
const MAX_CHAT_HISTORY_ITEMS = 50;
const DEBOUNCE_WAIT = 250; // ms

// CSS Classes and Style Values
const CLASS_ACTIVE = 'active';
const CLASS_DARK_MODE = 'dark-mode';
const CLASS_LIGHT_MODE = 'light-mode';
const CLASS_FADE_IN = 'fade-in';
const CLASS_FADE_OUT = 'fade-out';
const CLASS_VISIBLE = 'visible';
const CLASS_SHOW = 'show';
const CLASS_TABLE_RESPONSIVE = 'table-responsive';
const DISPLAY_BLOCK = 'block';
const DISPLAY_NONE = 'none';
const DISPLAY_FLEX = 'flex';

// ==========================================================================
// Global DOM Element Cache
// ==========================================================================

/**
 * @typedef {Object} CachedDOMElements
 * @property {HTMLHtmlElement | null} htmlElement - The root <html> element
 * @property {HTMLElement | null} body
 * @property {HTMLElement | null} tabContainer
 * @property {HTMLElement | null} chatbotContainer
 * @property {HTMLElement | null} chatbotToggle
 * @property {HTMLElement | null} chatbotClose
 * @property {HTMLElement | null} chatbotMessages
 * @property {HTMLInputElement | null} chatbotInput
 * @property {HTMLButtonElement | null} chatbotSend
 * @property {HTMLButtonElement | null} chatbotClearChatHistoryBtn
 * @property {HTMLButtonElement | null} chatbotClearAnalysisCacheBtn
 * @property {HTMLElement | null} spinnerOverlay
 * @property {HTMLElement | null} spinnerMessage
 * @property {HTMLInputElement | null} fileInput
 * @property {HTMLElement | null} uploadBox
 * @property {HTMLElement | null} selectedFileDiv
 * @property {HTMLSelectElement | null} requestDropdown
 * @property {HTMLElement | null} requestSelector
 * @property {HTMLElement | null} previewResults
 * @property {HTMLElement | null} results
 * @property {HTMLElement | null} resultsWrapper
 * @property {HTMLElement | null} evaluatorField
 * @property {HTMLInputElement | null} reportEvaluatorNameInput
 * @property {HTMLElement | null} nameHeading
 * @property {HTMLElement | null} toastContainer
 * @property {NodeListOf<HTMLElement> | null} steps
 * @property {HTMLElement | null} progressIndicator
 * @property {HTMLElement | null} darkModeToggleButton // For explicit listener attachment
 */

/** @type {CachedDOMElements} */
const DOMElements = {
    htmlElement: null,
    body: null,
    tabContainer: null,
    chatbotContainer: null,
    chatbotToggle: null,
    chatbotClose: null,
    chatbotMessages: null,
    chatbotInput: null,
    chatbotSend: null,
    chatbotClearChatHistoryBtn: null,
    chatbotClearAnalysisCacheBtn: null,
    spinnerOverlay: null,
    spinnerMessage: null,
    fileInput: null,
    uploadBox: null,
    selectedFileDiv: null,
    requestDropdown: null,
    requestSelector: null,
    previewResults: null,
    results: null,
    resultsWrapper: null,
    evaluatorField: null,
    reportEvaluatorNameInput: null,
    nameHeading: null,
    toastContainer: null,
    steps: null,
    progressIndicator: null,
    darkModeToggleButton: null,
};

// ==========================================================================
// Utility Functions
// ==========================================================================

/**
 * Debounces a function to limit how often it's called.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
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

/**
 * Shows a toast notification.
 * @param {string} message - The message to display in the toast.
 * @param {'success' | 'error' | 'info'} type - The type of toast.
 */
function showToast(message, type) {
    if (!DOMElements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    DOMElements.toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add(CLASS_SHOW), 100);

    setTimeout(() => {
        toast.classList.remove(CLASS_SHOW);
        setTimeout(() => {
            if (DOMElements.toastContainer && DOMElements.toastContainer.contains(toast)) {
                DOMElements.toastContainer.removeChild(toast);
            }
        }, TOAST_FADE_OUT_DURATION);
    }, TOAST_DURATION);
}

/**
 * Shows the spinner overlay with a custom message.
 * @param {string} message - The message to display with the spinner.
 */
function showSpinner(message) {
    if (DOMElements.spinnerOverlay && DOMElements.spinnerMessage) {
        DOMElements.spinnerMessage.textContent = message;
        DOMElements.spinnerOverlay.style.display = DISPLAY_BLOCK;
    }
}

/**
 * Hides the spinner overlay.
 */
function hideSpinner() {
    if (DOMElements.spinnerOverlay) {
        DOMElements.spinnerOverlay.style.display = DISPLAY_NONE;
    }
}

// ==========================================================================
// Tab Functionality
// ==========================================================================

/**
 * Opens a specific tab and hides others, managing fade transitions.
 * @param {Event} event - The click event from the tab link.
 * @param {string} tabName - The ID of the tab content to open.
 */
function openTab(event, tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    const tabLinks = document.getElementsByClassName('tab-link');
    const newTabContent = document.getElementById(tabName);

    if (!newTabContent) {
        console.error(`Tab content with ID "${tabName}" not found.`);
        return;
    }

    Array.from(tabLinks).forEach(link => link.classList.remove(CLASS_ACTIVE));
    event.currentTarget.classList.add(CLASS_ACTIVE);

    let currentActiveTabContent = Array.from(tabContents).find(content => content.classList.contains(CLASS_ACTIVE));

    const showNewTab = () => {
        Array.from(tabContents).forEach(content => {
            content.style.display = DISPLAY_NONE;
            content.classList.remove(CLASS_ACTIVE, CLASS_FADE_IN, CLASS_FADE_OUT);
        });
        newTabContent.style.display = DISPLAY_BLOCK;
        newTabContent.classList.add(CLASS_ACTIVE, CLASS_FADE_IN);
    };

    if (currentActiveTabContent && currentActiveTabContent !== newTabContent) {
        currentActiveTabContent.classList.add(CLASS_FADE_OUT);
        currentActiveTabContent.classList.remove(CLASS_FADE_IN, CLASS_ACTIVE);

        setTimeout(() => {
            if (currentActiveTabContent) {
                currentActiveTabContent.style.display = DISPLAY_NONE;
                currentActiveTabContent.classList.remove(CLASS_FADE_OUT);
            }
            showNewTab();
        }, FADE_DURATION);
    } else {
        showNewTab();
    }
}

// ==========================================================================
// Theme Management
// ==========================================================================

/**
 * Toggles dark mode and persists the theme choice in localStorage.
 */
function toggleDarkMode() {
    if (!DOMElements.htmlElement) {
        console.error("Theme toggle: HTML element not found in cache.");
        return;
    }

    // Toggle class on <html> element
    const isDarkMode = DOMElements.htmlElement.classList.toggle(CLASS_DARK_MODE);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    showToast(isDarkMode ? 'Dark Mode Enabled' : 'Light Mode Enabled', 'info');

    // Also toggle class on <body> element for compatibility with CSS that might target body.dark-mode
    if (DOMElements.body) {
        DOMElements.body.classList.toggle(CLASS_DARK_MODE, isDarkMode);
    }

    // Update specific components
    if (DOMElements.chatbotContainer) {
        DOMElements.chatbotContainer.classList.toggle(CLASS_DARK_MODE, isDarkMode);
    }
    if (DOMElements.chatbotToggle) {
        DOMElements.chatbotToggle.classList.toggle(CLASS_DARK_MODE, isDarkMode);
        DOMElements.chatbotToggle.classList.toggle(CLASS_LIGHT_MODE, !isDarkMode);
    }
}

/** Initializes the theme (dark/light mode) based on localStorage. */
function initTheme() {
    // The inline script in <head> handles the initial fast class application on <html>.
    // This JS function ensures consistency for <body> and other specific elements,
    // and acts as a fallback.
    if (!DOMElements.htmlElement || !DOMElements.body) {
        console.warn("initTheme: htmlElement or body not cached yet. This should be handled by inline script primarily.");
        // Attempt to get them directly if not cached, though this is less ideal
        const htmlEl = document.documentElement;
        const bodyEl = document.body;
        if (!htmlEl || !bodyEl) return; // Still can't find them, exit.

        const currentTheme = localStorage.getItem('theme') || 'light';
        const isDarkMode = currentTheme === 'dark';

        htmlEl.classList.toggle(CLASS_DARK_MODE, isDarkMode);
        bodyEl.classList.toggle(CLASS_DARK_MODE, isDarkMode);

        // Update chatbot toggle if it exists (it might not be cached yet here)
        const chatbotToggleEl = document.getElementById('chatbot-toggle');
        if (chatbotToggleEl) {
            chatbotToggleEl.classList.toggle(CLASS_DARK_MODE, isDarkMode);
            chatbotToggleEl.classList.toggle(CLASS_LIGHT_MODE, !isDarkMode);
        }
        const chatbotContainerEl = document.getElementById('chatbot-container');
        if (chatbotContainerEl) {
            chatbotContainerEl.classList.toggle(CLASS_DARK_MODE, isDarkMode);
        }
        return;
    }


    const currentTheme = localStorage.getItem('theme') || 'light';
    const isDarkMode = currentTheme === 'dark';

    // Ensure <html> tag has the correct class (inline script should have done this)
    DOMElements.htmlElement.classList.toggle(CLASS_DARK_MODE, isDarkMode);
    // Ensure <body> tag also has the correct class
    DOMElements.body.classList.toggle(CLASS_DARK_MODE, isDarkMode);


    if (DOMElements.chatbotToggle) {
        DOMElements.chatbotToggle.classList.toggle(CLASS_DARK_MODE, isDarkMode);
        DOMElements.chatbotToggle.classList.toggle(CLASS_LIGHT_MODE, !isDarkMode);
    }
    if (DOMElements.chatbotContainer) {
         DOMElements.chatbotContainer.classList.toggle(CLASS_DARK_MODE, isDarkMode);
    }
}


// ==========================================================================
// Step Wizard Functionality
// ==========================================================================

/**
 * Sets the active step in the step wizard and updates the progress bar.
 * @param {number} stepNumber - The 1-based index of the step to activate.
 */
function setStep(stepNumber) {
    if (DOMElements.steps && DOMElements.steps.length > 0) {
        DOMElements.steps.forEach((step, index) => {
            step.classList.toggle(CLASS_ACTIVE, index === stepNumber - 1);
        });
    }

    if (DOMElements.progressIndicator && DOMElements.steps && DOMElements.steps.length > 0) {
        const percent = (stepNumber / DOMElements.steps.length) * 100;
        DOMElements.progressIndicator.style.width = `${percent}%`;
    }
}

// ==========================================================================
// Chatbot Functionality
// ==========================================================================

/**
 * Appends a message to the chatbot interface and optionally saves it to history.
 * @param {'user' | 'bot'} sender - The sender of the message.
 * @param {string} message - The message content.
 * @param {string} [timestamp] - The timestamp of the message. Defaults to current time.
 * @param {boolean} [save=true] - Whether to save the message to chat history.
 */
function appendMessage(sender, message, timestamp, save = true) {
    if (!DOMElements.chatbotMessages) return;
    const messageTimestampStr = timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const messageElement = document.createElement('div');
    messageElement.classList.add('chatbot-message', sender);
    const messageContent = document.createElement('span');
    messageContent.textContent = message;
    const messageTimestampEl = document.createElement('span');
    messageTimestampEl.classList.add('chatbot-timestamp');
    messageTimestampEl.textContent = messageTimestampStr;

    messageElement.appendChild(messageContent);
    messageElement.appendChild(messageTimestampEl);
    DOMElements.chatbotMessages.appendChild(messageElement);
    DOMElements.chatbotMessages.scrollTop = DOMElements.chatbotMessages.scrollHeight;

    if (save) saveChatHistory(sender, message, messageTimestampStr);
}

/**
 * Saves a chat message to localStorage.
 * @param {'user' | 'bot'} sender - The sender of the message.
 * @param {string} message - The message content.
 * @param {string} timestamp - The timestamp of the message.
 */
function saveChatHistory(sender, message, timestamp) {
    try {
        let history = JSON.parse(localStorage.getItem('chatbotHistory')) || [];
        history.push({ sender, message, timestamp });
        if (history.length > MAX_CHAT_HISTORY_ITEMS) {
            history = history.slice(history.length - MAX_CHAT_HISTORY_ITEMS);
        }
        localStorage.setItem('chatbotHistory', JSON.stringify(history));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

/**
 * Loads chat history from localStorage and displays it.
 */
function loadChatHistory() {
    if (!DOMElements.chatbotMessages) return;
    try {
        const history = JSON.parse(localStorage.getItem('chatbotHistory')) || [];
        history.forEach(({ sender, message, timestamp }) => {
            appendMessage(sender, message, timestamp, false);
        });
    } catch (error) {
        console.error('Error loading chat history:', error);
        localStorage.removeItem('chatbotHistory');
    }
}

/**
 * Clears the chat history from the UI and localStorage.
 * @async
 */
async function clearChatHistory() {
    showSpinner('Clearing chat history...');
    try {
        if (typeof API_KEY === 'undefined') {
            console.warn('API_KEY is not defined. Skipping server-side chat history clear.');
            if (DOMElements.chatbotMessages) DOMElements.chatbotMessages.innerHTML = '';
            localStorage.removeItem('chatbotHistory');
            showToast('Client-side chat history cleared.', 'success');
            return;
        }

        const response = await fetch('/chat/clear', {
            method: 'POST',
            headers: { 'X-API-KEY': API_KEY },
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to clear server-side chat history');
        }
        const data = await response.json();

        if (DOMElements.chatbotMessages) DOMElements.chatbotMessages.innerHTML = '';
        localStorage.removeItem('chatbotHistory');
        showToast(data.message || 'Chat history cleared successfully.', 'success');
    } catch (error) {
        console.error('Error clearing chat history:', error);
        showToast(`Error clearing chat history: ${error.message}`, 'error');
        // Even on error, clear client-side UI if possible to avoid confusion
        if (DOMElements.chatbotMessages) DOMElements.chatbotMessages.innerHTML = '';
        localStorage.removeItem('chatbotHistory');
    } finally {
        hideSpinner();
    }
}

/** Shows a typing indicator in the chatbot. */
function showTypingIndicator() {
    if (!DOMElements.chatbotMessages || document.getElementById('typing-indicator')) return;
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typing-indicator';
    typingIndicator.innerHTML = '<i class="bi bi-robot animated-robot"></i> <span>.</span><span>.</span><span>.</span>';
    DOMElements.chatbotMessages.appendChild(typingIndicator);
    DOMElements.chatbotMessages.scrollTop = DOMElements.chatbotMessages.scrollHeight;
}

/** Removes the typing indicator from the chatbot. */
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) typingIndicator.remove();
}

/** Adjusts the chatbot size and position based on window width. */
function adjustChatbotSize() {
    if (!DOMElements.chatbotContainer) return;
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    DOMElements.chatbotContainer.style.width = isMobile ? '100%' : CHATBOT_DESKTOP_WIDTH_STR;
    DOMElements.chatbotContainer.style.maxHeight = isMobile ? '80vh' : '500px';
    DOMElements.chatbotContainer.style.bottom = isMobile ? '0' : '20px';
    DOMElements.chatbotContainer.style.borderRadius = isMobile ? '15px 15px 0 0' : '15px';

    if (DOMElements.chatbotContainer.classList.contains(CLASS_VISIBLE)) {
        DOMElements.chatbotContainer.style.right = isMobile ? CHATBOT_MOBILE_RIGHT_VISIBLE_STR : CHATBOT_DESKTOP_RIGHT_VISIBLE_STR;
    } else {
        DOMElements.chatbotContainer.style.right = isMobile ? CHATBOT_MOBILE_RIGHT_HIDDEN_STR : CHATBOT_DESKTOP_RIGHT_HIDDEN_STR;
    }
}

// ==========================================================================
// File Upload & Analysis Functionality
// ==========================================================================

/** Uploads the selected CSV file to the server. @async */
async function uploadCSV() {
    if (!DOMElements.fileInput || !DOMElements.fileInput.files || DOMElements.fileInput.files.length === 0) {
        showToast('Please select a CSV file first!', 'error');
        return;
    }
    setStep(1);
    const formData = new FormData();
    formData.append('file', DOMElements.fileInput.files[0]);
    showSpinner('Uploading CSV...');
    try {
        if (typeof API_KEY === 'undefined') throw new Error("API_KEY is not available for upload.");
        const response = await fetch('/upload', {
            method: 'POST',
            headers: { 'X-API-KEY': API_KEY },
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
        if (!data.requests || data.requests.length === 0) throw new Error('No processable rows found.');

        if (DOMElements.requestDropdown) {
            DOMElements.requestDropdown.innerHTML = '';
            data.requests.forEach(req => {
                const option = document.createElement('option');
                option.value = req.index;
                option.textContent = `Row ${req.index} - ${req.title}`;
                DOMElements.requestDropdown.add(option);
            });
        }
        setStep(2);
        if (DOMElements.requestSelector) {
            DOMElements.requestSelector.style.display = DISPLAY_BLOCK;
            DOMElements.requestSelector.scrollIntoView({ behavior: 'smooth' });
        }
        showToast('CSV uploaded successfully', 'success');
    } catch (error) {
        console.error('Upload failed:', error);
        showToast(`Upload failed: ${error.message}`, 'error');
        setStep(1);
    } finally {
        hideSpinner();
    }
}

/** Fetches and displays a preview of the selected CSV row. @async */
async function previewSelectedRequest() {
    if (!DOMElements.requestDropdown || !DOMElements.requestDropdown.value) { 
        showToast('No request selected.', 'error');
        return;
    }
    const rowIndex = DOMElements.requestDropdown.value;
    showSpinner('Loading preview...');
    try {
        const response = await fetch(`/preview_request/${rowIndex}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const rowData = await response.json();
        if (DOMElements.previewResults) {
            let html = "<table id='previewTable' class='preview-table'><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>";
            for (const key in rowData) {
                if (Object.hasOwnProperty.call(rowData, key)) {
                    html += `<tr><td data-label="Field">${key}</td><td data-label="Value">${rowData[key] === null ? 'N/A' : rowData[key]}</td></tr>`;
                }
            }
            html += "</tbody></table>";
            DOMElements.previewResults.innerHTML = html;
            adjustTableLayout();
        }
        showToast('Preview loaded', 'success');
    } catch (error) {
        console.error('Preview error:', error);
        showToast(`Preview error: ${error.message}`, 'error');
    } finally {
        hideSpinner();
    }
}

/** Retrieves and displays AI-generated analysis for the selected row. @async */
async function getSingleAnalysis() {
    if (!DOMElements.requestDropdown || !DOMElements.requestDropdown.value) { 
        showToast('No request selected.', 'error');
        return;
    }
    const rowIndex = DOMElements.requestDropdown.value;
    showSpinner('Retrieving analysis, please wait...');
    try {
        if (typeof API_KEY === 'undefined') throw new Error("API_KEY is not available for analysis.");
        const response = await fetch(`/prioritize/${rowIndex}`, {
            method: 'GET',
            headers: { 'X-API-KEY': API_KEY },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
        if (data.error) throw new Error(data.error);

        localStorage.setItem('latestAnalysis', data.analysis);
        let htmlAnalysis = '';
        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
            try {
                htmlAnalysis = marked.parse(data.analysis);
            } catch (markedError) {
                console.error('Error parsing Markdown:', markedError);
                htmlAnalysis = `<p style="color: red;">Error rendering Markdown: ${markedError.message}</p><pre>${data.analysis}</pre>`;
            }
        } else {
            console.warn('marked.js library is not available. Displaying raw Markdown.');
            htmlAnalysis = `<pre>${data.analysis}</pre>`;
        }
        setStep(3);
        let resultHTML = `<h3>Analysis for Row ${data.index}: ${data.title}</h3>`;
        resultHTML += `<h4>Directorate: ${data.directorate}</h4>`;
        resultHTML += htmlAnalysis;
        resultHTML += `<div class="report-actions" style="margin-top:20px;">
                         <button onclick="downloadReport()">Download Report as PDF</button>
                         <button onclick="copyReport()">Copy Report</button>
                         <button onclick="emailReport()">Email Report</button>
                       </div>`;
        if (DOMElements.results) DOMElements.results.innerHTML = resultHTML;
        applyHeatMapStyling();
        if (DOMElements.evaluatorField) DOMElements.evaluatorField.style.display = DISPLAY_BLOCK;
        if (DOMElements.resultsWrapper) DOMElements.resultsWrapper.scrollIntoView({ behavior: 'smooth' });
        showToast('Analysis retrieved successfully', 'success');
    } catch (error) {
        console.error('Analysis retrieval error:', error);
        showToast(`Analysis error: ${error.message}`, 'error');
        setStep(2);
    } finally {
        hideSpinner();
    }
}

/** Applies heat map styling to rating cells in the analysis table. */
function applyHeatMapStyling() {
    if (!DOMElements.results) return;
    const table = DOMElements.results.querySelector('table');
    if (!table) return;
    Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
        const cells = row.getElementsByTagName('td');
        if (cells.length >= 2) {
            const ratingCell = cells[1];
            const ratingText = ratingCell.textContent ? ratingCell.textContent.trim().toLowerCase() : '';
            let className = '';
            if (ratingText.includes('very high')) className = 'rating-very-high';
            else if (ratingText.includes('high')) className = 'rating-high';
            else if (ratingText.includes('medium')) className = 'rating-medium';
            else if (ratingText.includes('very low')) className = 'rating-very-low';
            else if (ratingText.includes('low')) className = 'rating-low';
            if (className) {
                ratingCell.innerHTML = `<span class="${className}">${ratingCell.textContent ? ratingCell.textContent.trim() : ''}</span>`;
            }
        }
    });
}

/** Adds the evaluator's name to the report display. */
function addEvaluatorName() {
    if (!DOMElements.reportEvaluatorNameInput || !DOMElements.results) return;
    const name = DOMElements.reportEvaluatorNameInput.value.trim();
    if (!name) {
        showToast('Please enter an evaluator name.', 'error');
        return;
    }
    let nameHeading = DOMElements.results.querySelector('#evaluatorNameHeading'); 
    if (!nameHeading) {
        nameHeading = document.createElement('h4');
        nameHeading.id = 'evaluatorNameHeading';
        nameHeading.style.marginTop = '10px';
        DOMElements.results.insertBefore(nameHeading, DOMElements.results.firstChild);
    }
    nameHeading.textContent = `Evaluator: ${name}`;
    showToast('Evaluator name added to report', 'success');
}

/** Clears the analysis cache on the server. @async */
async function clearAnalysisCache() {
    showSpinner('Clearing analysis cache...');
    try {
        if (typeof API_KEY === 'undefined') {
            console.warn('API_KEY is not defined. Cannot clear server-side analysis cache.');
            showToast('Cannot clear server cache: API Key missing.', 'error');
            return;
        }
        const response = await fetch('/analysis/clear', {
            method: 'POST',
            headers: { 'X-API-KEY': API_KEY },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to clear analysis cache');
        showToast(data.message || 'Analysis cache cleared.', 'success');
    } catch (error) {
        console.error('Error clearing analysis cache:', error);
        showToast(`Cache clear error: ${error.message}`, 'error');
    } finally {
        hideSpinner();
    }
}

// ==========================================================================
// Report Actions (Download, Copy, Email)
// ==========================================================================

/** Downloads the analysis report as a PDF file using html2pdf.js. */
function downloadReport() {
    if (!DOMElements.resultsWrapper) {
        showToast('Report content not found.', 'error'); return;
    }
    if (typeof html2pdf === 'undefined') {
        showToast('PDF library not loaded.', 'error'); console.error('html2pdf.js not loaded.'); return;
    }
    const opt = {
        margin: 0.5, filename: 'analysis_report.pdf', image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true }, pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    showSpinner('Generating PDF for download...');
    html2pdf().set(opt).from(DOMElements.resultsWrapper).save()
        .then(() => hideSpinner())
        .catch(err => {
            hideSpinner(); showToast('Failed to generate PDF.', 'error'); console.error('PDF error:', err);
        });
}

/** Copies the analysis report text to the clipboard. */
function copyReport() {
    if (!DOMElements.resultsWrapper) {
        showToast('Report content not found.', 'error'); return;
    }
    navigator.clipboard.writeText(DOMElements.resultsWrapper.innerText)
        .then(() => showToast('Report copied to clipboard', 'success'))
        .catch(err => {
            showToast('Failed to copy report.', 'error'); console.error('Clipboard copy error:', err);
        });
}

/** Emails the analysis report as a PDF attachment. @async */
async function emailReport() {
    const email = prompt('Enter email address to send the report to:');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        showToast('Please enter a valid email address.', 'error'); return;
    }
    if (!DOMElements.resultsWrapper) {
        showToast('Report content not found.', 'error'); return;
    }
    if (typeof html2pdf === 'undefined') {
        showToast('PDF library not loaded.', 'error'); console.error('html2pdf.js not loaded.'); return;
    }
    showSpinner('Generating PDF for email...');
    try {
        if (typeof API_KEY === 'undefined') throw new Error("API_KEY is not available for sending email.");
        const pdfDataUri = await html2pdf().from(DOMElements.resultsWrapper).output('datauristring');
        const pdfBase64 = pdfDataUri.split(',')[1];
        showSpinner('Sending email...');
        const response = await fetch('/send-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
            body: JSON.stringify({ email: email, pdf: pdfBase64 }),
        });
        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.error || 'Failed to send email');
        showToast(responseData.message || 'Email sent successfully.', 'success');
    } catch (error) {
        console.error('Email report error:', error);
        showToast(`Email error: ${error.message}`, 'error');
    } finally {
        hideSpinner();
    }
}

// ==========================================================================
// Responsive Layout Adjustments
// ==========================================================================

/** Adjusts table layouts for better mobile viewing by adding data-labels. */
function adjustTableLayout() {
    const tables = document.querySelectorAll('table');
    const isMobile = window.innerWidth <= TABLET_BREAKPOINT;
    tables.forEach(table => {
        table.classList.toggle(CLASS_TABLE_RESPONSIVE, isMobile);
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent ? th.textContent.trim() : '');
        if (isMobile && headers.length > 0) {
            Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
                Array.from(row.querySelectorAll('td')).forEach((cell, index) => {
                    if (headers[index]) cell.setAttribute('data-label', headers[index]);
                    else cell.removeAttribute('data-label');
                });
            });
        } else {
            Array.from(table.querySelectorAll('td[data-label]')).forEach(cell => cell.removeAttribute('data-label'));
        }
    });
}

// ==========================================================================
// Initialization Functions
// ==========================================================================

/** Initializes tab functionality on page load. */
function initTabs() {
    if (DOMElements.tabContainer) {
        const tabContents = document.getElementsByClassName('tab-content');
        Array.from(tabContents).forEach(tc => tc.style.display = DISPLAY_NONE);
        const defaultTabLink = DOMElements.tabContainer.querySelector('.tab-link[onclick*="english"]');
        const defaultTabContent = document.getElementById('english');

        if (defaultTabLink && defaultTabContent) {
            defaultTabLink.classList.add(CLASS_ACTIVE);
            defaultTabContent.style.display = DISPLAY_BLOCK;
            defaultTabContent.classList.add(CLASS_ACTIVE); 
        } else { 
            const firstTabLink = DOMElements.tabContainer.querySelector('.tab-link');
            if (firstTabLink) {
                const onclickAttr = firstTabLink.getAttribute('onclick');
                const tabNameMatch = onclickAttr ? onclickAttr.match(/openTab\(event,\s*'([^']+)'\)/) : null;
                if (tabNameMatch && tabNameMatch[1]) {
                    const firstTabContent = document.getElementById(tabNameMatch[1]);
                    if (firstTabContent) {
                        firstTabLink.classList.add(CLASS_ACTIVE);
                        firstTabContent.style.display = DISPLAY_BLOCK;
                        firstTabContent.classList.add(CLASS_ACTIVE);
                    }
                }
            }
        }
    }
}

/** Initializes chatbot visibility, state, and basic properties. */
function initChatbot() {
    if (!DOMElements.chatbotContainer || !DOMElements.chatbotToggle) return;
    DOMElements.chatbotContainer.style.display = DISPLAY_NONE;
    DOMElements.chatbotToggle.style.display = DISPLAY_FLEX;
    loadChatHistory();
    adjustChatbotSize();
}

/** Initializes file upload related elements and listeners. */
function initFileUpload() {
    if (DOMElements.fileInput) {
        DOMElements.fileInput.addEventListener('change', async () => {
            if (DOMElements.fileInput && DOMElements.fileInput.files && DOMElements.fileInput.files.length > 0) {
                const file = DOMElements.fileInput.files[0];
                if (DOMElements.selectedFileDiv) {
                    DOMElements.selectedFileDiv.textContent = `Selected: ${file.name}`;
                    DOMElements.selectedFileDiv.classList.add(CLASS_SHOW);
                }
                await uploadCSV();
            } else if (DOMElements.selectedFileDiv) {
                DOMElements.selectedFileDiv.textContent = '';
                DOMElements.selectedFileDiv.classList.remove(CLASS_SHOW);
            }
        });
    }
    if (DOMElements.uploadBox && DOMElements.fileInput) {
        DOMElements.uploadBox.addEventListener('click', () => DOMElements.fileInput.click());
    }
}

/** Initializes common page setup like table layouts. */
function initCommonPageSetup() {
    adjustTableLayout();
}

/** Initializes all major event listeners. */
function initEventListeners() {
    // The HTML uses onclick="toggleDarkMode()", so `toggleDarkMode` must be global.
    // If you were to use addEventListener for the dark mode toggle button:
    // if (DOMElements.darkModeToggleButton) {
    // DOMElements.darkModeToggleButton.addEventListener('click', toggleDarkMode);
    // }

    if (DOMElements.chatbotToggle && DOMElements.chatbotContainer) {
        DOMElements.chatbotToggle.addEventListener('click', () => {
            const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
            DOMElements.chatbotContainer.style.display = DISPLAY_FLEX;
            requestAnimationFrame(() => { 
                DOMElements.chatbotContainer.classList.add(CLASS_VISIBLE);
                DOMElements.chatbotContainer.style.right = isMobile ? CHATBOT_MOBILE_RIGHT_VISIBLE_STR : CHATBOT_DESKTOP_RIGHT_VISIBLE_STR;
            });
            if (DOMElements.chatbotToggle) DOMElements.chatbotToggle.style.display = DISPLAY_NONE;
        });
    }

    if (DOMElements.chatbotClose && DOMElements.chatbotContainer && DOMElements.chatbotToggle) {
        DOMElements.chatbotClose.addEventListener('click', (e) => {
            e.stopPropagation();
            const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
            DOMElements.chatbotContainer.classList.remove(CLASS_VISIBLE);
            DOMElements.chatbotContainer.style.right = isMobile ? CHATBOT_MOBILE_RIGHT_HIDDEN_STR : CHATBOT_DESKTOP_RIGHT_HIDDEN_STR;
            setTimeout(() => {
                if(DOMElements.chatbotContainer) DOMElements.chatbotContainer.style.display = DISPLAY_NONE; 
                if(DOMElements.chatbotToggle) DOMElements.chatbotToggle.style.display = DISPLAY_FLEX; 
            }, FADE_DURATION);
        });
    }

    if (DOMElements.chatbotSend && DOMElements.chatbotInput) {
        DOMElements.chatbotSend.addEventListener('click', async () => {
            const userQuery = DOMElements.chatbotInput.value.trim();
            if (!userQuery) return;
            appendMessage('user', userQuery);
            DOMElements.chatbotInput.value = '';
            const latestAnalysis = localStorage.getItem('latestAnalysis') || '';
            showTypingIndicator();
            try {
                if (typeof API_KEY === 'undefined') throw new Error("API_KEY is not available for chat.");
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
                    body: JSON.stringify({ query: userQuery, analysis: latestAnalysis }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.response || data.error || `HTTP error! status: ${response.status}`);
                appendMessage('bot', data.response || 'Sorry, I could not understand.');
            } catch (error) {
                console.error('Chatbot send error:', error);
                appendMessage('bot', `Error: ${error.message}`);
            } finally {
                removeTypingIndicator();
            }
        });
        DOMElements.chatbotInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (DOMElements.chatbotSend) DOMElements.chatbotSend.click();
            }
        });
    }

    if (DOMElements.chatbotClearChatHistoryBtn) {
        DOMElements.chatbotClearChatHistoryBtn.addEventListener('click', clearChatHistory);
    }
    if (DOMElements.chatbotClearAnalysisCacheBtn) {
        DOMElements.chatbotClearAnalysisCacheBtn.addEventListener('click', clearAnalysisCache);
    }

    window.addEventListener('resize', debounce(() => {
        adjustChatbotSize();
        adjustTableLayout();
    }, DEBOUNCE_WAIT));
}

// ==========================================================================
// DOMContentLoaded - Main Entry Point
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    DOMElements.htmlElement = document.documentElement; 
    DOMElements.body = document.body;
    DOMElements.tabContainer = document.querySelector('.tab-container');
    DOMElements.chatbotContainer = document.getElementById('chatbot-container');
    DOMElements.chatbotToggle = document.getElementById('chatbot-toggle');
    DOMElements.chatbotClose = document.getElementById('chatbot-close');
    DOMElements.chatbotMessages = document.getElementById('chatbot-messages');
    DOMElements.chatbotInput = document.getElementById('chatbot-input');
    DOMElements.chatbotSend = document.getElementById('chatbot-send');
    DOMElements.chatbotClearChatHistoryBtn = document.getElementById('chatbot-clear');
    DOMElements.chatbotClearAnalysisCacheBtn = document.getElementById('chatbot-clear-cache');
    DOMElements.spinnerOverlay = document.getElementById('spinnerOverlay');
    DOMElements.spinnerMessage = document.getElementById('spinnerMessage');
    DOMElements.fileInput = document.getElementById('csvFile');
    DOMElements.uploadBox = document.querySelector('.upload-box');
    DOMElements.selectedFileDiv = document.getElementById('selectedFile');
    DOMElements.requestDropdown = document.getElementById('requestDropdown');
    DOMElements.requestSelector = document.getElementById('requestSelector');
    DOMElements.previewResults = document.getElementById('previewResults');
    DOMElements.results = document.getElementById('results');
    DOMElements.resultsWrapper = document.getElementById('resultsWrapper');
    DOMElements.evaluatorField = document.getElementById('evaluatorField');
    DOMElements.reportEvaluatorNameInput = document.getElementById('reportEvaluatorName');
    DOMElements.toastContainer = document.getElementById('toastContainer');
    DOMElements.steps = document.querySelectorAll('.step-wizard .step');
    DOMElements.progressIndicator = document.getElementById('progress-indicator');
    DOMElements.darkModeToggleButton = document.querySelector('.dark-mode-toggle'); 

    // Call initTheme AFTER DOMElements.htmlElement and DOMElements.body are cached.
    // The inline script in <head> handles the very first paint.
    initTheme(); 
    initTabs();
    initChatbot();
    initFileUpload();
    initCommonPageSetup();
    initEventListeners();

    // setStep(1); // Optional: Set initial step
});
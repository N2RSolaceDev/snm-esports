<!-- Place this script tag just before the closing </body> tag in your admin.html -->
<script>
    // --- Updated Client-side JavaScript for admin.html ---
    document.addEventListener('DOMContentLoaded', function () {
        // DOM Elements
        const mobileMenu = document.querySelector('.mobile-menu');
        const navMenu = document.querySelector('nav ul');
        const loginContainer = document.getElementById('loginContainer');
        const adminDashboard = document.getElementById('adminDashboard');
        const loginForm = document.getElementById('loginForm');
        const errorMessage = document.getElementById('errorMessage');
        const logoutBtn = document.getElementById('logoutBtn');
        const applicationsList = document.getElementById('applicationsList');
        const noApplicationsMessage = document.getElementById('noApplicationsMessage'); // Use the existing message element
        const totalAppsEl = document.getElementById('totalApps');
        const pendingAppsEl = document.getElementById('pendingApps');
        const approvedAppsEl = document.getElementById('approvedApps');
        const rejectedAppsEl = document.getElementById('rejectedApps');

        // --- Helper Functions ---

        // Mobile Menu Toggle
        if (mobileMenu) {
            mobileMenu.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        // --- Core Logic ---

        // Check for existing valid token on page load
        checkAndLoadDashboard();

        // Login Form Submission
        if (loginForm) {
            loginForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;

                // Basic client-side check
                if (!username || !password) {
                    showErrorMessage('Please enter both username and password.');
                    return;
                }

                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username, password })
                    });

                    const data = await response.json();

                    if (response.ok && data.success && data.token) {
                        localStorage.setItem('adminToken', data.token);
                        showDashboard();
                        loadApplications(); // Load apps after successful login
                    } else {
                        // Handle login failure
                        const message = data.message || 'Login failed. Please check your credentials.';
                        showErrorMessage(message);
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    showErrorMessage('An error occurred during login. Please try again.');
                }
            });
        }

        // Logout Function
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                localStorage.removeItem('adminToken');
                showLogin();
                if (loginForm) loginForm.reset();
                hideErrorMessage(); // Clear any previous error messages
            });
        }

        // --- UI Helper Functions ---

        function showLogin() {
            if (loginContainer) loginContainer.style.display = 'flex'; // Use flex to center
            if (adminDashboard) adminDashboard.style.display = 'none';
        }

        function showDashboard() {
            if (loginContainer) loginContainer.style.display = 'none';
            if (adminDashboard) adminDashboard.style.display = 'block';
        }

        function showErrorMessage(message) {
            if (errorMessage) {
                errorMessage.textContent = message;
                errorMessage.style.display = 'block';
                // Auto-hide error after a few seconds
                setTimeout(() => {
                    hideErrorMessage();
                }, 5000);
            }
        }

        function hideErrorMessage() {
            if (errorMessage) {
                errorMessage.style.display = 'none';
            }
        }

        // --- Application Management ---

        // Check token and load dashboard if valid
        function checkAndLoadDashboard() {
            const token = localStorage.getItem('adminToken');
            if (token) {
                showDashboard();
                loadApplications(); // Attempt to load apps
            } else {
                showLogin();
            }
        }

        // Load Applications Function (Fetches from protected API)
        async function loadApplications() {
            // Show loading state
            if (noApplicationsMessage) {
                noApplicationsMessage.textContent = 'Loading applications...';
                noApplicationsMessage.style.display = 'block';
            }
            if (applicationsList) {
                 applicationsList.innerHTML = ''; // Clear previous list
            }

            try {
                const token = localStorage.getItem('adminToken');
                if (!token) {
                    throw new Error("No authentication token found.");
                }

                const response = await fetch('/api/applications', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}` // Include the JWT token
                    }
                });

                if (!response.ok) {
                    // Handle specific HTTP errors
                    if (response.status === 401 || response.status === 403) {
                        // Token is invalid or expired
                        console.warn("Authentication failed, redirecting to login.");
                        alert('Session expired or invalid. Please log in again.');
                        localStorage.removeItem('adminToken'); // Clear invalid token
                        showLogin(); // Show login screen
                        return;
                    }
                    // For other errors, throw a generic one
                    throw new Error(`Failed to load applications: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();

                // Ensure the data structure is as expected
                if (data.success && Array.isArray(data.applications)) {
                    displayApplications(data.applications);
                    updateStats(data.applications);
                } else {
                    throw new Error('Invalid data format received from server.');
                }
            } catch (error) {
                console.error('Error loading applications:', error);
                if (noApplicationsMessage) {
                    noApplicationsMessage.textContent = 'Error loading applications. Please try again.';
                    noApplicationsMessage.style.display = 'block';
                }
                // Reset stats on error
                updateStats([]); // Pass empty array to reset stats
            }
        }

        // Display Applications Function
        function displayApplications(applications) {
            if (!applicationsList) return; // Safety check

            applicationsList.innerHTML = ''; // Clear the list

            if (!applications || applications.length === 0) {
                if (noApplicationsMessage) {
                    noApplicationsMessage.textContent = 'No applications found.';
                    noApplicationsMessage.style.display = 'block';
                }
                return;
            }

            if (noApplicationsMessage) {
                 noApplicationsMessage.style.display = 'none'; // Hide the "no apps" message
            }

            // Sort applications by submission date (newest first)
            const sortedApplications = [...applications].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

            sortedApplications.forEach(app => {
                const appCard = document.createElement('div');
                appCard.className = 'application-card';

                // Simple HTML escaping for display (basic protection)
                const escapeHtml = (text) => {
                    if (typeof text !== 'string') return text;
                    return text
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "<")
                        .replace(/>/g, ">")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                };

                // Build role-specific details HTML
                let roleSpecificDetails = '';
                if (app.role === 'player') {
                    roleSpecificDetails = `
                        <p><strong>Player Type:</strong> ${escapeHtml(app.playerType || 'N/A')}</p>
                        ${app.playerType === 'competitive' ? `
                            <p><strong>Game:</strong> ${escapeHtml(app.game || 'N/A')}</p>
                            <p><strong>Tracker Link:</strong> ${escapeHtml(app.trackerLink || 'N/A')}</p>
                        ` : ''}
                        ${app.playerType === 'creative' ? `
                            <p><strong>Social Links:</strong> ${escapeHtml(app.socialLinks || 'N/A')}</p>
                            <p><strong>Content Sample:</strong> ${escapeHtml(app.contentSample || 'N/A')}</p>
                        ` : ''}
                        <p><strong>Gaming Experience:</strong> ${escapeHtml(app.gamingExperience || 'N/A')}</p>
                        <p><strong>Availability:</strong> ${escapeHtml(app.availability || 'N/A')}</p>
                    `;
                } else if (app.role === 'staff') {
                    roleSpecificDetails = `
                        <p><strong>Position:</strong> ${escapeHtml(app.position || 'N/A')}</p>
                        <p><strong>Skills:</strong> ${escapeHtml(app.skills || 'N/A')}</p>
                        <p><strong>Resume Link:</strong> ${escapeHtml(app.resumeLink || 'N/A')}</p>
                        <p><strong>Portfolio:</strong> ${escapeHtml(app.portfolio || 'N/A')}</p>
                    `;
                } else {
                     // Fallback for applications submitted before role selection existed or if data is missing
                     roleSpecificDetails = `<p><strong>In Discord:</strong> ${escapeHtml(app.inDiscord || 'N/A')}</p>`;
                }

                appCard.innerHTML = `
                    <div class="application-header">
                        <h3>${escapeHtml(app.fullName || 'N/A')}</h3>
                        <span class="application-status status-${escapeHtml(app.status)}">${escapeHtml(app.status)}</span>
                    </div>
                    <div class="application-details">
                        <p><strong>Email:</strong> ${escapeHtml(app.email || 'N/A')}</p>
                        <p><strong>Discord:</strong> ${escapeHtml(app.discord || 'N/A')}</p>
                        <p><strong>Role:</strong> ${escapeHtml(app.role || 'N/A')}</p>
                        <p><strong>Submitted:</strong> ${new Date(app.submittedAt).toLocaleString()}</p>
                        ${roleSpecificDetails}
                    </div>
                    <div class="application-actions">
                        ${app.status === 'pending' ? `
                            <button class="action-btn approve-btn" data-id="${escapeHtml(app.id)}">Approve</button>
                            <button class="action-btn reject-btn" data-id="${escapeHtml(app.id)}">Reject</button>
                        ` : `<span>Status is final.</span>`}
                    </div>
                `;
                applicationsList.appendChild(appCard);
            });

            // --- Add event listeners to the newly created action buttons ---
            // Use event delegation on the parent container
            if (applicationsList) {
                 applicationsList.addEventListener('click', function(event) {
                    if (event.target.classList.contains('approve-btn')) {
                        const id = event.target.getAttribute('data-id');
                        if (id) updateApplicationStatus(id, 'approved');
                    } else if (event.target.classList.contains('reject-btn')) {
                        const id = event.target.getAttribute('data-id');
                         if (id) updateApplicationStatus(id, 'rejected');
                    }
                });
            }
        }

        // Update Statistics Function
        function updateStats(applications) {
             // Ensure applications is an array
             const apps = Array.isArray(applications) ? applications : [];
             const total = apps.length;
             const pending = apps.filter(app => app.status === 'pending').length;
             const approved = apps.filter(app => app.status === 'approved').length;
             const rejected = apps.filter(app => app.status === 'rejected').length;

             if (totalAppsEl) totalAppsEl.textContent = total;
             if (pendingAppsEl) pendingAppsEl.textContent = pending;
             if (approvedAppsEl) approvedAppsEl.textContent = approved;
             if (rejectedAppsEl) rejectedAppsEl.textContent = rejected;
        }

        // Update Application Status Function (Calls protected API)
        async function updateApplicationStatus(id, status) {
             // Simple confirmation
             if (!confirm(`Are you sure you want to set application ID ${id} to ${status}?`)) {
                 return;
             }

            try {
                const token = localStorage.getItem('adminToken');
                if (!token) {
                    throw new Error("No authentication token found.");
                }

                const response = await fetch(`/api/applications/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // Include the JWT token
                    },
                    body: JSON.stringify({ status: status })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Reload the list to show the updated status
                    loadApplications();
                } else {
                    const message = data.message || 'Unknown error';
                    alert(`Failed to update status: ${message}`);
                    // If the error is due to authentication, logout
                    if (response.status === 401 || response.status === 403) {
                        console.warn("Authentication failed during status update, redirecting to login.");
                        alert('Session expired or invalid. Please log in again.');
                        localStorage.removeItem('adminToken');
                        showLogin();
                    }
                }
            } catch (error) {
                console.error('Error updating application status:', error);
                alert('An error occurred while updating the status.');
            }
        }

    }); // End of DOMContentLoaded
</script>

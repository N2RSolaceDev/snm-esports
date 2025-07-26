// DOM Elements
const mobileMenu = document.querySelector('.mobile-menu');
const navMenu = document.querySelector('nav ul');
const loginForm = document.getElementById('loginForm');
const applicationForm = document.getElementById('applicationForm');
const adminDashboard = document.getElementById('adminDashboard');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const applicationsList = document.getElementById('applicationsList');
const logoutBtn = document.getElementById('logoutBtn');

// Stats elements
const totalApplicationsEl = document.getElementById('totalApplications');
const pendingApplicationsEl = document.getElementById('pendingApplications');
const approvedApplicationsEl = document.getElementById('approvedApplications');
const rejectedApplicationsEl = document.getElementById('rejectedApplications');

// Initialize applications array
let applications = JSON.parse(localStorage.getItem('applications')) || [];

// Mobile Menu Toggle
if (mobileMenu) {
    mobileMenu.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
}

// Check if user is logged in
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn && window.location.pathname.includes('admin.html')) {
        document.querySelector('.login-container').style.display = 'none';
        adminDashboard.style.display = 'block';
        loadApplications();
    } else if (!isLoggedIn && window.location.pathname.includes('admin.html')) {
        document.querySelector('.login-container').style.display = 'flex';
        adminDashboard.style.display = 'none';
    }
}

// Login form submission
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Send login request to server
        fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                localStorage.setItem('isLoggedIn', 'true');
                document.querySelector('.login-container').style.display = 'none';
                adminDashboard.style.display = 'block';
                loadApplications();
            } else {
                errorMessage.style.display = 'block';
                setTimeout(() => {
                    errorMessage.style.display = 'none';
                }, 3000);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorMessage.style.display = 'block';
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 3000);
        });
    });
}

// Logout functionality
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('isLoggedIn');
        document.querySelector('.login-container').style.display = 'flex';
        adminDashboard.style.display = 'none';
    });
}

// Application form submission
if (applicationForm) {
    applicationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const applicationData = {};
        
        for (let [key, value] of formData.entries()) {
            applicationData[key] = value;
        }
        
        // Send application to server
        fetch('/api/applications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(applicationData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                applicationForm.style.display = 'none';
                successMessage.style.display = 'block';
                
                // Reset form
                this.reset();
            } else {
                alert('Error submitting application. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error submitting application. Please try again.');
        });
    });
}

// Load applications for admin panel
function loadApplications() {
    // Fetch applications from server
    fetch('/api/applications')
    .then(response => response.json())
    .then(data => {
        applications = data.applications || [];
        updateStats();
        
        // Clear current list
        applicationsList.innerHTML = '';
        
        // Sort applications by submission date (newest first)
        const sortedApplications = [...applications].sort((a, b) => 
            new Date(b.submittedAt) - new Date(a.submittedAt)
        );
        
        // Display applications
        if (sortedApplications.length === 0) {
            applicationsList.innerHTML = '<p>No applications found.</p>';
            return;
        }
        
        sortedApplications.forEach(app => {
            const appElement = document.createElement('div');
            appElement.className = 'application-card';
            appElement.innerHTML = `
                <div class="application-header">
                    <h3>${app.fullName}</h3>
                    <span class="application-status status-${app.status}">${app.status.charAt(0).toUpperCase() + app.status.slice(1)}</span>
                </div>
                <div class="application-details">
                    <p><strong>Email:</strong> ${app.email}</p>
                    <p><strong>Game:</strong> ${app.game}</p>
                    <p><strong>Experience:</strong> ${app.experience.substring(0, 100)}${app.experience.length > 100 ? '...' : ''}</p>
                    <p><strong>Submitted:</strong> ${new Date(app.submittedAt).toLocaleString()}</p>
                </div>
                ${app.status === 'pending' ? `
                <div class="application-actions">
                    <button class="action-btn approve-btn" data-id="${app.id}">Approve</button>
                    <button class="action-btn reject-btn" data-id="${app.id}">Reject</button>
                </div>
                ` : ''}
            `;
            applicationsList.appendChild(appElement);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-id'));
                updateApplicationStatus(id, 'approved');
            });
        });
        
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-id'));
                updateApplicationStatus(id, 'rejected');
            });
        });
    })
    .catch(error => {
        console.error('Error loading applications:', error);
    });
}

// Update application status
function updateApplicationStatus(id, status) {
    fetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadApplications();
        } else {
            alert('Error updating application status.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error updating application status.');
    });
}

// Update dashboard stats
function updateStats() {
    totalApplicationsEl.textContent = applications.length;
    pendingApplicationsEl.textContent = applications.filter(app => app.status === 'pending').length;
    approvedApplicationsEl.textContent = applications.filter(app => app.status === 'approved').length;
    rejectedApplicationsEl.textContent = applications.filter(app => app.status === 'rejected').length;
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
});

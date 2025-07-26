// DOM Elements
const mobileMenu = document.querySelector('.mobile-menu');
const navMenu = document.querySelector('nav ul');
const loginForm = document.getElementById('loginForm');
const applicationForm = document.getElementById('applicationForm');
const adminDashboard = document.getElementById('adminDashboard');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const applicationsList = document.getElementById('applicationsList');
const contactsList = document.getElementById('contactsList');
const logoutBtn = document.getElementById('logoutBtn');

// Stats elements
const totalApplicationsEl = document.getElementById('totalApplications');
const pendingApplicationsEl = document.getElementById('pendingApplications');
const approvedApplicationsEl = document.getElementById('approvedApplications');
const rejectedApplicationsEl = document.getElementById('rejectedApplications');
const totalContactsEl = document.getElementById('totalContacts');
const unreadContactsEl = document.getElementById('unreadContacts');
const readContactsEl = document.getElementById('readContacts');

// Application form steps
const applicationSteps = document.querySelectorAll('.application-step');
const stepElements = document.querySelectorAll('.step');
let currentStep = 0;

// Check if user is logged in
function checkLoginStatus() {
    const token = localStorage.getItem('token');
    if (token && window.location.pathname.includes('admin.html')) {
        document.querySelector('.login-container').style.display = 'none';
        adminDashboard.style.display = 'block';
        loadApplications();
        loadContacts();
    } else if (!token && window.location.pathname.includes('admin.html')) {
        document.querySelector('.login-container').style.display = 'flex';
        adminDashboard.style.display = 'none';
    }
}

// Mobile Menu Toggle
if (mobileMenu) {
    mobileMenu.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
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
                localStorage.setItem('token', data.token);
                document.querySelector('.login-container').style.display = 'none';
                adminDashboard.style.display = 'block';
                loadApplications();
                loadContacts();
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
        localStorage.removeItem('token');
        document.querySelector('.login-container').style.display = 'flex';
        adminDashboard.style.display = 'none';
    });
}

// Application form steps
function showStep(stepIndex) {
    applicationSteps.forEach((step, index) => {
        step.classList.toggle('active', index === stepIndex);
    });
    
    stepElements.forEach((step, index) => {
        step.classList.toggle('active', index === stepIndex);
        step.classList.toggle('completed', index < stepIndex);
    });
    
    currentStep = stepIndex;
}

// Next step in application form
function nextStep() {
    if (currentStep < applicationSteps.length - 1) {
        showStep(currentStep + 1);
    }
}

// Previous step in application form
function prevStep() {
    if (currentStep > 0) {
        showStep(currentStep - 1);
    }
}

// Application form submission
if (applicationForm) {
    // Initialize form steps
    showStep(0);
    
    // Handle role selection
    const roleSelect = document.getElementById('role');
    if (roleSelect) {
        roleSelect.addEventListener('change', function() {
            const playerFields = document.getElementById('player-fields');
            const staffFields = document.getElementById('staff-fields');
            
            if (this.value === 'player') {
                playerFields.style.display = 'block';
                staffFields.style.display = 'none';
            } else if (this.value === 'staff') {
                playerFields.style.display = 'none';
                staffFields.style.display = 'block';
            } else {
                playerFields.style.display = 'none';
                staffFields.style.display = 'none';
            }
        });
    }
    
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
                showStep(0);
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

// Contact form submission
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const contactData = {};
        
        for (let [key, value] of formData.entries()) {
            contactData[key] = value;
        }
        
        // Send contact message to server
        fetch('/api/contacts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contactData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                contactForm.style.display = 'none';
                document.getElementById('contactSuccessMessage').style.display = 'block';
                
                // Reset form
                this.reset();
            } else {
                alert('Error sending message. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error sending message. Please try again.');
        });
    });
}

// Load applications for admin panel
function loadApplications() {
    // Fetch applications from server
    fetch('/api/applications')
    .then(response => response.json())
    .then(data => {
        const applications = data.applications || [];
        updateApplicationStats(applications);
        
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
                    <p><strong>Role:</strong> ${app.role}</p>
                    <p><strong>Game:</strong> ${app.game}</p>
                    <p><strong>Experience:</strong> ${app.experience.substring(0, 100)}${app.experience.length > 100 ? '...' : ''}</p>
                    <p><strong>Submitted:</strong> ${new Date(app.submittedAt).toLocaleString()}</p>
                    ${app.trackerLink ? `<p><strong>Tracker Link:</strong> <a href="${app.trackerLink}" target="_blank">${app.trackerLink}</a></p>` : ''}
                    ${app.resumeLink ? `<p><strong>Resume Link:</strong> <a href="${app.resumeLink}" target="_blank">${app.resumeLink}</a></p>` : ''}
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

// Load contacts for admin panel
function loadContacts() {
    // Fetch contacts from server
    fetch('/api/contacts')
    .then(response => response.json())
    .then(data => {
        const contacts = data.contacts || [];
        updateContactStats(contacts);
        
        // Clear current list
        contactsList.innerHTML = '';
        
        // Sort contacts by submission date (newest first)
        const sortedContacts = [...contacts].sort((a, b) => 
            new Date(b.submittedAt) - new Date(a.submittedAt)
        );
        
        // Display contacts
        if (sortedContacts.length === 0) {
            contactsList.innerHTML = '<p>No messages found.</p>';
            return;
        }
        
        sortedContacts.forEach(contact => {
            const contactElement = document.createElement('div');
            contactElement.className = 'contact-card';
            contactElement.innerHTML = `
                <div class="contact-header">
                    <h3>${contact.name}</h3>
                    <span class="contact-status status-${contact.status}">${contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}</span>
                </div>
                <div class="contact-details">
                    <p><strong>Email:</strong> ${contact.email}</p>
                    <p><strong>Subject:</strong> ${contact.subject}</p>
                    <p><strong>Message:</strong> ${contact.message.substring(0, 150)}${contact.message.length > 150 ? '...' : ''}</p>
                    <p><strong>Submitted:</strong> ${new Date(contact.submittedAt).toLocaleString()}</p>
                </div>
                <div class="contact-actions">
                    ${contact.status === 'unread' ? `
                    <button class="action-btn approve-btn" data-id="${contact.id}">Mark as Read</button>
                    ` : ''}
                    <button class="action-btn delete-btn" data-id="${contact.id}">Delete</button>
                </div>
            `;
            contactsList.appendChild(contactElement);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.contact-card .approve-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-id'));
                updateContactStatus(id, 'read');
            });
        });
        
        document.querySelectorAll('.contact-card .delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.getAttribute('data-id'));
                deleteContact(id);
            });
        });
    })
    .catch(error => {
        console.error('Error loading contacts:', error);
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

// Update contact status
function updateContactStatus(id, status) {
    fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadContacts();
        } else {
            alert('Error updating contact status.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error updating contact status.');
    });
}

// Delete contact
function deleteContact(id) {
    if (confirm('Are you sure you want to delete this message?')) {
        // In a real app, we would send a DELETE request to the server
        // For this demo, we'll simulate deletion
        alert('Message deleted successfully');
        loadContacts();
    }
}

// Update application dashboard stats
function updateApplicationStats(applications) {
    totalApplicationsEl.textContent = applications.length;
    pendingApplicationsEl.textContent = applications.filter(app => app.status === 'pending').length;
    approvedApplicationsEl.textContent = applications.filter(app => app.status === 'approved').length;
    rejectedApplicationsEl.textContent = applications.filter(app => app.status === 'rejected').length;
}

// Update contact dashboard stats
function updateContactStats(contacts) {
    totalContactsEl.textContent = contacts.length;
    unreadContactsEl.textContent = contacts.filter(contact => contact.status === 'unread').length;
    readContactsEl.textContent = contacts.filter(contact => contact.status === 'read').length;
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
});

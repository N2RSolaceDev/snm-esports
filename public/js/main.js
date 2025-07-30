<!-- Place this script tag just before the closing </body> tag in your admin.html (News Management Only Version) -->
<script>
// --- Client-side JavaScript for admin.html (News Management ONLY) ---
document.addEventListener('DOMContentLoaded', function () {
    // --- DOM Elements (Ensure these IDs match your simplified admin.html) ---
    const mobileMenu = document.querySelector('.mobile-menu');
    const navMenu = document.querySelector('nav ul');
    const loginContainer = document.getElementById('loginContainer');
    const adminDashboard = document.getElementById('adminDashboard');
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage'); // For login errors
    const logoutBtn = document.getElementById('logoutBtn');

    // --- News Management Elements ---
    const newsForm = document.getElementById('newsForm');
    const newsList = document.getElementById('newsList');
    const noNewsMessage = document.getElementById('noNewsMessage'); // Message when list is empty/loading
    const newsErrorMessage = document.getElementById('newsErrorMessage'); // For news form errors
    const totalNewsEl = document.getElementById('totalNews'); // Stat card for total news

    // --- Helper Functions ---
    function showLogin() {
        if (loginContainer) loginContainer.style.display = 'flex';
        if (adminDashboard) adminDashboard.style.display = 'none';
        if (loginForm) loginForm.reset();
        if (errorMessage) errorMessage.style.display = 'none';
        // Reset news form/messages on logout if they exist
        if (newsForm) newsForm.reset();
        if (newsErrorMessage) newsErrorMessage.style.display = 'none';
    }

    function hideLogin() {
        if (loginContainer) loginContainer.style.display = 'none';
        if (adminDashboard) adminDashboard.style.display = 'block';
    }

    // --- Mobile Menu Toggle ---
    if (mobileMenu) {
        mobileMenu.addEventListener('click', () => {
            if (navMenu) navMenu.classList.toggle('active');
        });
    }

    // --- Check for existing token on page load ---
    const token = localStorage.getItem('adminToken');
    if (token) {
        hideLogin();
        loadNews(); // Load news on initial check
    } else {
        showLogin();
    }

    // --- Login Form Submission ---
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const username = document.getElementById('username')?.value;
            const password = document.getElementById('password')?.value;

            if (!username || !password) {
                if (errorMessage) {
                    errorMessage.style.display = 'block';
                    errorMessage.textContent = 'Username and password are required.';
                }
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
                    hideLogin();
                    loadNews(); // Load news after successful login
                } else {
                    if (errorMessage) {
                        errorMessage.style.display = 'block';
                        errorMessage.textContent = data.message || 'Login failed.';
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                if (errorMessage) {
                    errorMessage.style.display = 'block';
                    errorMessage.textContent = 'An error occurred during login. Please try again.';
                }
            }
        });
    }

    // --- Logout Function ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            localStorage.removeItem('adminToken');
            showLogin();
        });
    }

    // --- News Management ---

    // Load News Function
    async function loadNews() {
         if (noNewsMessage) {
             noNewsMessage.textContent = 'Loading news...';
             noNewsMessage.style.display = 'block';
         }
         if (newsList) newsList.innerHTML = ''; // Clear previous list

         try {
             const token = localStorage.getItem('adminToken');
             if (!token) {
                 throw new Error("No authentication token found.");
             }

             const response = await fetch('/api/news', {
                 method: 'GET',
                 headers: {
                     'Authorization': `Bearer ${token}`
                 }
             });

             if (!response.ok) {
                 // If the error is due to authentication, logout
                 if (response.status === 401 || response.status === 403) {
                     console.warn("Authentication failed for news, redirecting to login.");
                     alert('Session expired or invalid. Please log in again.');
                     localStorage.removeItem('adminToken');
                     showLogin();
                     return;
                 }
                 // For other errors, throw a generic one
                 throw new Error(`Failed to load news: ${response.status} ${response.statusText}`);
             }

             const data = await response.json();
             // Ensure the data structure is as expected
             if (data.success && Array.isArray(data.news)) {
                 displayNews(data.news);
                 // Update news stats
                 if (totalNewsEl) totalNewsEl.textContent = data.news.length;
             } else {
                 throw new Error('Invalid data format received for news.');
             }
         } catch (error) {
             console.error('Error loading news:', error);
             if (noNewsMessage) {
                 noNewsMessage.textContent = 'Error loading news. Please try again.';
                 noNewsMessage.style.display = 'block';
             }
             // Reset news stats on error
             if (totalNewsEl) totalNewsEl.textContent = '0';
         }
     }

     // Display News Function
     function displayNews(newsItems) {
         if (!newsList) return; // Safety check
         newsList.innerHTML = ''; // Clear the list

         if (!newsItems || newsItems.length === 0) {
             if (noNewsMessage) {
                 noNewsMessage.textContent = 'No news articles found.';
                 noNewsMessage.style.display = 'block';
             }
             return;
         }

         if (noNewsMessage) {
             noNewsMessage.style.display = 'none'; // Hide the "no news" message
         }

         // Sort news by published date (newest first)
         const sortedNews = [...newsItems].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

         sortedNews.forEach(item => {
             const newsCard = document.createElement('div');
             newsCard.className = 'news-card';

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

             // Get first line for preview
             const firstLine = escapeHtml((item.description || '').split(/\r?\n/)[0] || 'No description available.');

             newsCard.innerHTML = `
                 <div class="news-card-header">
                     <h3>${escapeHtml(item.title || 'Untitled')}</h3>
                 </div>
                 <div class="news-card-content">
                     <p><strong>Date:</strong> ${new Date(item.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                     <p><strong>Preview:</strong> ${firstLine}</p>
                     ${item.bannerUrl ? `<p><strong>Banner:</strong> <a href="${escapeHtml(item.bannerUrl)}" target="_blank">View Image</a></p>` : ''}
                 </div>
                 <div class="news-card-actions">
                     <button class="action-btn delete-btn" data-id="${escapeHtml(item.id)}">Delete</button>
                 </div>
             `;
             newsList.appendChild(newsCard);
         });

         // --- Add event listeners for Delete buttons using event delegation ---
         if (newsList) {
             newsList.addEventListener('click', function(event) {
                 if (event.target.classList.contains('delete-btn')) {
                     const id = event.target.getAttribute('data-id');
                     if (id) deleteNews(id);
                 }
             });
         }
     }


     // News Form Submission Handler
     if (newsForm) {
         newsForm.addEventListener('submit', async function(e) {
             e.preventDefault();
             if (newsErrorMessage) {
                 newsErrorMessage.style.display = 'none';
                 newsErrorMessage.textContent = '';
             }

             const formData = new FormData(this);
             const newsData = {
                 title: formData.get('title')?.trim(),
                 description: formData.get('description')?.trim(),
                 bannerUrl: formData.get('bannerUrl')?.trim() || '' // Allow empty
             };

             // Basic validation
             if (!newsData.title || !newsData.description) {
                 if (newsErrorMessage) {
                     newsErrorMessage.textContent = 'Title and Description are required.';
                     newsErrorMessage.style.display = 'block';
                 }
                 return;
             }

             try {
                 const token = localStorage.getItem('adminToken');
                 if (!token) {
                     throw new Error("No authentication token found.");
                 }

                 const response = await fetch('/api/news', {
                     method: 'POST',
                     headers: {
                         'Content-Type': 'application/json',
                         'Authorization': `Bearer ${token}`
                     },
                     body: JSON.stringify(newsData)
                 });

                 if (response.ok) {
                     const data = await response.json();
                     if (data.success) {
                         alert('News article published successfully!');
                         newsForm.reset(); // Clear the form
                         loadNews(); // Reload the news list
                     } else {
                         throw new Error(data.message || 'Unknown error from server.');
                     }
                 } else {
                     if (response.status === 401 || response.status === 403) {
                         alert('Session expired or invalid. Please log in again.');
                         localStorage.removeItem('adminToken');
                         showLogin();
                         return;
                     } else {
                         const errorData = await response.json();
                         throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                     }
                 }
             } catch (error) {
                 console.error('Error publishing news:', error);
                 if (newsErrorMessage) {
                     newsErrorMessage.textContent = 'Failed to publish news: ' + error.message;
                     newsErrorMessage.style.display = 'block';
                 }
             }
         });
     }

     // Delete News Function
     async function deleteNews(id) {
         // Simple confirmation
         if (!confirm(`Are you sure you want to permanently delete news article ID ${id}? This action cannot be undone.`)) {
             return;
         }

         try {
             const token = localStorage.getItem('adminToken');
             if (!token) {
                 throw new Error("No authentication token found.");
             }

             const response = await fetch(`/api/news/${id}`, {
                 method: 'DELETE',
                 headers: {
                     'Authorization': `Bearer ${token}`
                 }
             });

             const data = await response.json();

             if (response.ok && data.success) {
                 alert('News article deleted successfully.');
                 loadNews(); // Reload the list to reflect the deletion
             } else {
                 const message = data.message || 'Unknown error';
                 alert(`Failed to delete news article: ${message}`);

                 // If the error is due to authentication, logout
                 if (response.status === 401 || response.status === 403) {
                     console.warn("Authentication failed during delete, redirecting to login.");
                     alert('Session expired or invalid. Please log in again.');
                     localStorage.removeItem('adminToken');
                     showLogin();
                 } else if (response.status === 404) {
                     alert('News article not found. It might have already been deleted.');
                     loadNews(); // Reload list as it might be out of sync
                 }
             }
         } catch (error) {
             console.error('Error deleting news article:', error);
             alert('An error occurred while deleting the news article.');
         }
     }

});
</script>

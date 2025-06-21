document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    // The layout.js script should handle the redirect
    if (!token) return; 

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    
    const profileForm = document.getElementById('profileForm');
    const passwordForm = document.getElementById('passwordForm');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');

    // Fetch initial user data
    const fetchUserData = async () => {
        try {
            const response = await fetch('/api/user/profile', { headers });
            const user = await response.json();
            if (response.ok) {
                fullNameInput.value = user.full_name;
                emailInput.value = user.email;
            } else {
                 throw new Error(user.error || 'Failed to fetch user data');
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            showToast('Could not load user data.', 'error');
        }
    };

    // Handle profile form submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updatedData = {
            fullName: fullNameInput.value
        };

        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers,
                body: JSON.stringify(updatedData)
            });
            const result = await response.json();
            if (response.ok) {
                showToast('Profile updated successfully!');
                // Also update the name in the header
                const userNameEl = document.querySelector('.user-menu .user-name');
                if (userNameEl) userNameEl.textContent = result.user.fullName;
            } else {
                throw new Error(result.error || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast(error.message, 'error');
        }
    });

    // Handle password form submission
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showToast('Password functionality is not yet implemented.', 'error');
        // Placeholder for password change logic
    });
    
    // Toast notification utility
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.className = toast.className.replace('show', '');
        }, 3000);
    }
    
    // Initial fetch
    fetchUserData();
}); 

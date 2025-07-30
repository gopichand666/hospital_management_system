document.addEventListener('DOMContentLoaded', () => {
    const patientRegisterForm = document.getElementById('patientRegistrationForm');
    const patientLoginForm = document.getElementById('patientLoginForm');
    const doctorLoginForm = document.getElementById('doctorLoginForm');
    const adminLoginForm = document.getElementById('adminLoginForm'); // Ensure this is selected

    // --- Helper function to handle form submissions ---
    async function handleSubmit(event, apiEndpoint, redirectPath = null) { // redirectPath is now optional
        event.preventDefault(); // Prevent default form submission

        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Special handling for confirm password on registration (client-side validation)
        if (apiEndpoint === '/api/patient/register' && data.password !== data.confirmPassword) {
            alert('Passwords do not match!');
            return;
        }
        // Remove confirmPassword before sending to backend
        if (data.confirmPassword) {
            delete data.confirmPassword;
        }

        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.msg || 'Success!');
                if (result.token) {
                    localStorage.setItem('token', result.token); // Store the JWT
                    localStorage.setItem('userRole', result.role); // Store the user role
                    localStorage.setItem('userId', result.userId); // Store user ID
                    localStorage.setItem('username', result.username); // Store username
                    localStorage.setItem('fullName', result.fullName); // Store full name

                    // Redirect based on role or specific path
                    if (redirectPath) { // If a specific redirect path is given, use it
                        window.location.href = redirectPath;
                    } else if (result.role === 'admin') {
                        window.location.href = '/admin-dashboard.html';
                    } else if (result.role === 'doctor') {
                        window.location.href = '/doctor-dashboard.html';
                    } else if (result.role === 'patient') {
                        window.location.href = '/patient-dashboard.html';
                    } else {
                        // Default fallback redirect
                        window.location.href = '/';
                    }
                } else {
                    // For registration where auto-login is not desired,
                    // or if the API just returns success without a token.
                    if (apiEndpoint === '/api/patient/register') {
                        window.location.href = '/patient-login.html'; // Redirect to login after registration
                    }
                }
            } else {
                alert(`Error: ${result.msg || response.statusText}`);
                console.error('API Error:', result);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            alert('Network error or server is unreachable. Check console for details.');
        }
    }

    // --- Attach event listeners to forms ---
    if (patientRegisterForm) {
        patientRegisterForm.addEventListener('submit', (event) => {
            handleSubmit(event, '/api/patient/register');
        });
    }

    if (patientLoginForm) {
        patientLoginForm.addEventListener('submit', (event) => {
            handleSubmit(event, '/api/patient/login');
        });
    }

    if (doctorLoginForm) {
        doctorLoginForm.addEventListener('submit', (event) => {
            handleSubmit(event, '/api/doctor/login');
        });
    }

    // --- Corrected Admin Login Event Listener ---
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (event) => {
            handleSubmit(event, '/api/auth/login'); // <<< CORRECTED ENDPOINT
        });
    }

    // --- Simple Logout Functionality ---
    // Attaches to all elements with id 'logoutButton' (e.g., on dashboards)
    document.querySelectorAll('#logoutButton').forEach(button => {
        button.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('fullName');
            alert('You have been logged out.');
            window.location.href = '/'; // Redirect to home/portal selection
        });
    });
});
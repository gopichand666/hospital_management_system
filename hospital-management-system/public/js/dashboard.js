document.addEventListener('DOMContentLoaded', () => {
    const menuButton = document.getElementById('menu-button');
    const closeButton = document.getElementById('close-menu-button');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const navLinks = document.querySelectorAll('#sidebar nav a');
    const sections = document.querySelectorAll('.dashboard-section');
    const mainContent = document.querySelector('main');

    // Function to toggle the sidebar
    const toggleMenu = () => {
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    };

    // Function to show a specific section and hide others
    const showSection = (hash) => {
        // If no hash is provided, default to the first section
        const targetId = hash ? hash.substring(1) : (sections.length > 0 ? sections[0].id : null);
        
        if (!targetId) return;

        sections.forEach(section => {
            if (section.id === targetId) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });
        
        // Scroll to the top of the main content area
        mainContent.scrollTop = 0;
    };

    // --- Event Listeners ---

    // Open menu when hamburger button is clicked
    if (menuButton) {
        menuButton.addEventListener('click', toggleMenu);
    }

    // Close menu when the close button inside the sidebar is clicked
    if (closeButton) {
        closeButton.addEventListener('click', toggleMenu);
    }

    // Close menu when the overlay is clicked
    if (overlay) {
        overlay.addEventListener('click', toggleMenu);
    }

    // Handle navigation link clicks
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default anchor behavior
            const targetHash = link.getAttribute('href');
            
            // Update the URL hash
            window.location.hash = targetHash;
            
            // Show the corresponding section
            showSection(targetHash);
            
            // Close the menu (especially important for mobile view)
            if (window.innerWidth < 768) {
                toggleMenu();
            }
        });
    });

    // --- Initial Page Load ---

    // Show the correct section based on the URL hash on initial load
    if (window.location.hash) {
        showSection(window.location.hash);
    } else {
        // Show the first section by default if no hash is present
        showSection();
    }
});
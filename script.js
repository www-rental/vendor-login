import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    deleteUser,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    doc, 
    deleteDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAQVE7puyekeZd4tKcyAxLNDtLL6DOPApI",
    authDomain: "rent-5d.firebaseapp.com",
    projectId: "rent-5d",
    storageBucket: "rent-5d.firebasestorage.app",
    messagingSenderId: "848398219490",
    appId: "1:848398219490:web:9488a5944ebdc76b8686bb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 2. DOM Element Selectors
const authForm = document.getElementById('auth-form');
const authContainer = document.getElementById('auth-container');
const dashboard = document.getElementById('dashboard');
const confirmWrapper = document.getElementById('confirm-wrapper');
const togglePassword = document.getElementById('togglePassword');
const passwordField = document.getElementById('password');
const vehicleForm = document.getElementById('vehicle-form');
const detailsModal = document.getElementById('details-modal');
const countryInput = document.getElementById('country');
const phoneInput = document.getElementById('phone');

// Navigation & Account Controls
const logoutBtn = document.getElementById('logout-btn');
const deleteUserModal = document.getElementById('delete-user-modal');
const deleteConfirmInput = document.getElementById('delete-confirm-input');
const finalDeleteBtn = document.getElementById('final-delete-btn');
const openDeleteModalBtn = document.getElementById('open-delete-modal-btn');
const closeDeleteModal = document.getElementById('close-delete-modal');

let isLoginMode = true;
let currentViewingId = null;
let unsubscribeVehicles = null; // Real-time listener cleanup handle

// Helper function to sanitize output and protect against XSS injections
function sanitizeText(str) {
    const temp = document.createElement('div');
    temp.textContent = str || '';
    return temp.innerHTML;
}

// 3. AUTH OBSERVATION & REALTIME DATA STREAM
onAuthStateChanged(auth, (user) => {
    let vehicleList = document.getElementById('vehicle-list');

    if (user) {
        // Logged in: show workspace
        authContainer.classList.add('hidden');
        dashboard.classList.remove('hidden');

        // Start database subscription if not active
        if (!unsubscribeVehicles) {
            const q = query(collection(db, "vehicles"), orderBy("timestamp", "desc"));
            
            unsubscribeVehicles = onSnapshot(q, (snapshot) => {
                if (!vehicleList) {
                    vehicleList = document.createElement('div');
                    vehicleList.id = 'vehicle-list';
                    dashboard.insertBefore(vehicleList, openDeleteModalBtn);
                }
                
                vehicleList.innerHTML = '';
                if (snapshot.empty) {
                    vehicleList.innerHTML = '<p style="text-align:center; color: var(--text-muted); margin-top:20px;">No vehicles listed yet.</p>';
                    return;
                }

                snapshot.forEach((snapshotDoc) => {
                    const data = snapshotDoc.data();
                    const docId = snapshotDoc.id;
                    const card = document.createElement('div');
                    card.className = 'vehicle-card'; // Matches CSS styling
                    
                    const carName = sanitizeText(data.carDetails?.name || 'Unknown Vehicle');
                    const carModel = sanitizeText(data.carDetails?.model || 'N/A');
                    const place = sanitizeText(data.location?.place || 'N/A');
                    const district = sanitizeText(data.location?.district || 'N/A');
                    const rent = sanitizeText(data.pricePerDay || '0');

                    card.innerHTML = `
                        <h3>${carName} (${carModel})</h3>
                        <p class="vehicle-location">📍 ${place}, ${district}</p>
                        <div class="vehicle-footer">
                            <span class="vehicle-price">₹${rent} / day</span>
                            <span class="badge-details">View Details</span>
                        </div>
                    `;
                    card.onclick = () => showDetails(docId, data);
                    vehicleList.appendChild(card);
                });
            }, (error) => {
                console.error("Firestore Snapshot Error:", error);
            });
        }
    } else {
        // Logged out: teardown subscription and clear data from UI
        if (unsubscribeVehicles) {
            unsubscribeVehicles();
            unsubscribeVehicles = null;
        }
        
        if (vehicleList) {
            vehicleList.innerHTML = '';
        }

        dashboard.classList.add('hidden');
        authContainer.classList.remove('hidden');
        authForm.reset();
    }
});

// 4. AUTHENTICATION (LOGIN / SIGN UP)
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = passwordField.value;
    const submitBtn = document.getElementById('submit-btn');

    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";

    try {
        if (!isLoginMode) {
            const confirmPass = document.getElementById('confirm-password').value;
            if (password !== confirmPass) {
                alert("Passwords do not match!");
                submitBtn.disabled = false;
                submitBtn.innerText = "Sign Up";
                return;
            }
            await createUserWithEmailAndPassword(auth, email, password);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        alert("Authentication Failed: " + error.message);
        submitBtn.disabled = false;
        submitBtn.innerText = isLoginMode ? 'Login' : 'Sign Up';
    }
});

// 5. LOGOUT
logoutBtn.onclick = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        alert("Logout failed: " + error.message);
    }
};

// 6. COUNTRY CODE AUTO-COMPLETE LOGIC
const countryCodes = {
    "India": "+91", "USA": "+1", "United States": "+1",
    "UK": "+44", "United Kingdom": "+44", "UAE": "+971",
    "Canada": "+1", "Australia": "+61"
};

countryInput.addEventListener('input', () => {
    const val = countryInput.value.trim();
    if (countryCodes[val]) {
        const code = countryCodes[val] + " ";
        if (!phoneInput.value.startsWith(countryCodes[val])) {
            phoneInput.value = code;
        }
    }
});

phoneInput.addEventListener('keydown', (e) => {
    const selectedCountry = countryInput.value.trim();
    const code = countryCodes[selectedCountry];
    if (code && e.key === 'Backspace') {
        if (phoneInput.selectionStart <= code.length + 1) {
            e.preventDefault();
        }
    }
});

// 7. UI TOGGLES
window.toggleAuthMode = function() {
    isLoginMode = !isLoginMode;
    document.getElementById('form-title').innerText = isLoginMode ? 'Login' : 'Create Account';
    document.getElementById('submit-btn').innerText = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('switch-text').innerText = isLoginMode 
        ? "Don't have an account? Create one" 
        : "Already have an account? Login";
    confirmWrapper.classList.toggle('hidden', isLoginMode);
};

togglePassword.addEventListener('click', () => {
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);
    togglePassword.innerText = type === 'password' ? '👁️' : '🙈';
});

// 8. ACCOUNT DELETION
openDeleteModalBtn.onclick = () => deleteUserModal.classList.remove('hidden');
closeDeleteModal.onclick = () => {
    deleteUserModal.classList.add('hidden');
    deleteConfirmInput.value = "";
    finalDeleteBtn.disabled = true;
};

deleteConfirmInput.addEventListener('input', () => {
    finalDeleteBtn.disabled = (deleteConfirmInput.value !== "DELETE USER");
});

finalDeleteBtn.onclick = async () => {
    const user = auth.currentUser;
    if (user) {
        try {
            await deleteUser(user);
            alert("Account deleted successfully.");
            location.reload(); 
        } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
                alert("Security check: Please log out and log back in before deleting your account.");
            } else {
                alert("Error: " + error.message);
            }
        }
    }
};

// 9. DETAILS MODAL & DELETE LISTING
function showDetails(id, data) {
    currentViewingId = id;
    
    const name = sanitizeText(data.carDetails?.name || 'Vehicle');
    const model = sanitizeText(data.carDetails?.model || 'N/A');
    const owner = sanitizeText(data.ownerName || 'N/A');
    const phone = sanitizeText(data.phone || '');
    const place = sanitizeText(data.location?.place || '');
    const district = sanitizeText(data.location?.district || '');
    const state = sanitizeText(data.location?.state || '');
    const country = sanitizeText(data.location?.country || '');
    const fuel = sanitizeText(data.carDetails?.fuel || 'N/A');
    const transmission = sanitizeText(data.carDetails?.transmission || 'N/A');
    const rent = sanitizeText(data.pricePerDay || '0');

    document.getElementById('view-carName').innerText = `${name} (${model})`;
    document.getElementById('view-details-body').innerHTML = `
        <div style="text-align: left; line-height: 1.6;">
            <p><strong>Owner:</strong> ${owner}</p>
            <p><strong>Phone:</strong> <a href="tel:${phone}" style="color: var(--accent-violet);">${phone || 'N/A'}</a></p>
            <p><strong>Location:</strong> ${place}, ${district}, ${state}, ${country}</p>
            <hr>
            <p><strong>Fuel:</strong> ${fuel}</p>
            <p><strong>Transmission:</strong> ${transmission}</p>
            <p><strong>Daily Rent:</strong> ₹${rent}</p>
        </div>
    `;
    detailsModal.classList.remove('hidden');
}

document.getElementById('delete-listing-btn').onclick = async () => {
    if (!currentViewingId) return;
    if (confirm("Are you sure you want to delete this listing permanently?")) {
        try {
            await deleteDoc(doc(db, "vehicles", currentViewingId));
            detailsModal.classList.add('hidden');
            alert("Listing removed.");
        } catch (err) {
            alert("Delete failed: " + err.message);
        }
    }
};

document.getElementById('close-details-btn').onclick = () => detailsModal.classList.add('hidden');

// 10. CREATE VEHICLE LISTING
const modal = document.getElementById('modal');
const saveVehicleBtn = document.getElementById('save-vehicle-btn');

document.getElementById('add-btn').onclick = () => modal.classList.remove('hidden');
document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');

vehicleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fuel = document.getElementById('fuel').value;
    const trans = document.getElementById('transmission').value;
    
    if (!fuel || !trans || fuel === "" || trans === "") {
        alert("Please select fuel and transmission types.");
        return;
    }

    saveVehicleBtn.disabled = true;
    saveVehicleBtn.innerText = "Saving Listing...";

    try {
        await addDoc(collection(db, "vehicles"), {
            userId: auth.currentUser ? auth.currentUser.uid : null, // Added UID for Security Rules validation
            ownerName: document.getElementById('owner').value,
            phone: document.getElementById('phone').value, 
            location: {
                country: document.getElementById('country').value,
                state: document.getElementById('state').value,
                district: document.getElementById('district').value,
                place: document.getElementById('place').value,
            },
            carDetails: {
                name: document.getElementById('carName').value,
                model: document.getElementById('model').value,
                fuel: fuel,
                transmission: trans,
            },
            pricePerDay: document.getElementById('price').value,
            timestamp: serverTimestamp()
        });
        
        modal.classList.add('hidden');
        vehicleForm.reset();
    } catch (err) {
        alert("Save failed: " + err.message);
    } finally {
        saveVehicleBtn.disabled = false;
        saveVehicleBtn.innerText = "Submit Listing";
    }
});

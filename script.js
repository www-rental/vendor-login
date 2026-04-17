import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    deleteUser 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// 2. Elements
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

// New Elements for Logout and Deletion
const logoutBtn = document.getElementById('logout-btn');
const deleteUserModal = document.getElementById('delete-user-modal');
const deleteConfirmInput = document.getElementById('delete-confirm-input');
const finalDeleteBtn = document.getElementById('final-delete-btn');
const openDeleteModalBtn = document.getElementById('open-delete-modal-btn');
const closeDeleteModal = document.getElementById('close-delete-modal');

// --- COUNTRY CODE LOGIC ---
const countryCodes = {
    "India": "+91",
    "USA": "+1",
    "United States": "+1",
    "UK": "+44",
    "United Kingdom": "+44",
    "UAE": "+971",
    "Canada": "+1",
    "Australia": "+61"
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

let isLoginMode = true;
let currentViewingId = null;

// --- 3. Toggle Login / Signup ---
window.toggleAuthMode = function() {
    isLoginMode = !isLoginMode;
    document.getElementById('form-title').innerText = isLoginMode ? 'Login' : 'Create Account';
    document.getElementById('submit-btn').innerText = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('switch-text').innerText = isLoginMode 
        ? "Don't have an account? Create one" 
        : "Already have an account? Login";
    confirmWrapper.classList.toggle('hidden', isLoginMode);
};

// --- 4. Show/Hide Password ---
togglePassword.addEventListener('click', () => {
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);
    togglePassword.innerText = type === 'password' ? '👁️' : '🙈';
});

// --- 5. Handle Firebase Authentication ---
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = passwordField.value;

    try {
        if (!isLoginMode) {
            const confirmPass = document.getElementById('confirm-password').value;
            if (password !== confirmPass) {
                alert("Passwords do not match!");
                return;
            }
            await createUserWithEmailAndPassword(auth, email, password);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
        authContainer.classList.add('hidden');
        dashboard.classList.remove('hidden');
    } catch (error) {
        alert(error.message);
    }
});

// --- 6. Logout Logic ---
logoutBtn.onclick = async () => {
    try {
        await signOut(auth);
        dashboard.classList.add('hidden');
        authContainer.classList.remove('hidden');
        authForm.reset(); // Clear login fields
    } catch (error) {
        alert("Logout failed: " + error.message);
    }
};

// --- 7. Account Deletion Logic ---
openDeleteModalBtn.onclick = () => deleteUserModal.classList.remove('hidden');
closeDeleteModal.onclick = () => {
    deleteUserModal.classList.add('hidden');
    deleteConfirmInput.value = "";
    finalDeleteBtn.disabled = true;
};

// Enable "Delete" button only if user types "DELETE USER" exactly
deleteConfirmInput.addEventListener('input', () => {
    finalDeleteBtn.disabled = (deleteConfirmInput.value !== "DELETE USER");
});

finalDeleteBtn.onclick = async () => {
    const user = auth.currentUser;
    if (user) {
        try {
            await deleteUser(user);
            alert("Account deleted successfully.");
            location.reload(); // Returns to login screen
        } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
                alert("Security check: Please log out and log back in before deleting your account.");
            } else {
                alert("Error: " + error.message);
            }
        }
    }
};

// --- 8. Real-time Display ---
const q = query(collection(db, "vehicles"), orderBy("timestamp", "desc"));
onSnapshot(q, (snapshot) => {
    let vehicleList = document.getElementById('vehicle-list');
    if (!vehicleList) {
        vehicleList = document.createElement('div');
        vehicleList.id = 'vehicle-list';
        dashboard.insertBefore(vehicleList, openDeleteModalBtn);
    }
    
    vehicleList.innerHTML = '';
    if (snapshot.empty) {
        vehicleList.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">No vehicles listed yet.</p>';
    }

    snapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        const docId = snapshotDoc.id;
        const card = document.createElement('div');
        card.style = "border: 1px solid #ddd; padding: 15px; margin-top: 10px; border-radius: 8px; background: #fff; cursor: pointer; transition: transform 0.2s;";
        card.innerHTML = `
            <h3 style="margin: 0;">${data.carDetails.name} (${data.carDetails.model})</h3>
            <p style="color: #666; margin: 5px 0;">📍 ${data.location.place}, ${data.location.district}</p>
            <p><strong>₹${data.pricePerDay} / day</strong></p>
        `;
        card.onclick = () => showDetails(docId, data);
        vehicleList.appendChild(card);
    });
});

// --- 9. Details Pop-up ---
function showDetails(id, data) {
    currentViewingId = id;
    document.getElementById('view-carName').innerText = `${data.carDetails.name} (${data.carDetails.model})`;
    document.getElementById('view-details-body').innerHTML = `
        <div style="text-align: left; line-height: 1.6;">
            <p><strong>Owner:</strong> ${data.ownerName}</p>
            <p><strong>Phone:</strong> <a href="tel:${data.phone}">${data.phone}</a></p>
            <p><strong>Location:</strong> ${data.location.place}, ${data.location.district}, ${data.location.state}, ${data.location.country}</p>
            <hr>
            <p><strong>Fuel:</strong> ${data.carDetails.fuel}</p>
            <p><strong>Transmission:</strong> ${data.carDetails.transmission}</p>
            <p><strong>Daily Rent:</strong> ₹${data.pricePerDay}</p>
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

// --- 10. Vehicle Submission ---
const modal = document.getElementById('modal');
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

    try {
        await addDoc(collection(db, "vehicles"), {
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
            timestamp: new Date()
        });
        modal.classList.add('hidden');
        vehicleForm.reset();
    } catch (err) {
        alert("Save failed: " + err.message);
    }
});
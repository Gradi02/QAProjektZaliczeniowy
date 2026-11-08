import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    verifyBeforeUpdateEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCadGYPSpN1jzgoLRbhg3n4PcfkwO0WrwU",
  authDomain: "chessvoiceapp.firebaseapp.com",
  projectId: "chessvoiceapp",
  storageBucket: "chessvoiceapp.firebasestorage.app",
  messagingSenderId: "394622464444",
  appId: "1:394622464444:web:e218bbbb94e21610da7bb9",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let userToken = null;
let isRegisterMode = false;

// DOM
const loginContainer = document.getElementById('login-container');
const userStatusCard = document.getElementById('user-status');
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLogout = document.getElementById('btn-logout');
const userNameSpan = document.getElementById('user-name');
const userAvatarImg = document.getElementById('user-avatar');

// Formularz
const emailForm = document.getElementById('email-auth-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const btnEmailAction = document.getElementById('btn-email-action');
const toggleLink = document.getElementById('auth-toggle-link');
const toggleText = document.getElementById('auth-toggle-text');
const errorMsg = document.getElementById('auth-error-msg');
const forgotPassLink = document.getElementById('forgot-password-link');
const passReqList = document.getElementById('password-requirements');

// Status Usera
const verificationBadge = document.getElementById('verification-badge');
const verificationWarning = document.getElementById('verification-warning');
const resendVerBtn = document.getElementById('resend-verification-btn');

// Ustawienia
const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
const settingsPanel = document.getElementById('user-settings-panel');
const newEmailInput = document.getElementById('new-email-input');
const btnChangeEmail = document.getElementById('btn-change-email');
const settingsMsg = document.getElementById('settings-msg');



const validatePassword = (password) => {
    const hasLength = password.length >= 8;
    const hasNum = /\d/.test(password);
    const hasCap = /[A-Z]/.test(password);

    document.getElementById('req-len').className = hasLength ? 'valid' : 'invalid';
    document.getElementById('req-num').className = hasNum ? 'valid' : 'invalid';
    document.getElementById('req-cap').className = hasCap ? 'valid' : 'invalid';

    return hasLength && hasNum && hasCap;
};

if(passwordInput) {
    passwordInput.addEventListener('input', (e) => {
        if(isRegisterMode) validatePassword(e.target.value);
    });
}

if(btnLoginGoogle) {
    btnLoginGoogle.addEventListener('click', async () => {
        try {
            errorMsg.innerText = '';
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Błąd Google:", error);
            errorMsg.innerText = "Błąd logowania Google.";
        }
    });
}

if(toggleLink) {
    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isRegisterMode = !isRegisterMode;
        errorMsg.innerText = '';

        if (isRegisterMode) {
            btnEmailAction.innerText = "Zarejestruj się";
            toggleText.innerText = "Masz już konto?";
            toggleLink.innerText = "Zaloguj się";
            passwordInput.autocomplete = "new-password";
            passReqList.classList.remove('hidden');
            forgotPassLink.style.display = 'none';

            document.getElementById('req-len').className = 'invalid';
            document.getElementById('req-num').className = 'invalid';
            document.getElementById('req-cap').className = 'invalid';
        } else {
            btnEmailAction.innerText = "Zaloguj się";
            toggleText.innerText = "Nie masz konta?";
            toggleLink.innerText = "Zarejestruj się";
            passwordInput.autocomplete = "current-password";
            passReqList.classList.add('hidden');
            forgotPassLink.style.display = 'block';
        }
    });
}

if(emailForm) {
    emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        errorMsg.innerText = '';

        if(password.length < 6) {
            errorMsg.innerText = "Hasło musi mieć min. 6 znaków.";
            return;
        }

        try {
            if (isRegisterMode) {
                if(!validatePassword(password)) {
                    errorMsg.innerText = "Hasło nie spełnia wymagań.";
                    return;
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await sendEmailVerification(userCredential.user);
                alert("Konto utworzone! Sprawdź skrzynkę email, aby potwierdzić konto.");

            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            handleAuthError(error);
        }
    });
}

if(forgotPassLink) {
    forgotPassLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        if(!email) {
            errorMsg.innerText = "Wpisz swój email w pole powyżej, aby zresetować hasło.";
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            errorMsg.style.color = "var(--success)";
            errorMsg.innerText = "Link do resetu hasła wysłany na email!";
            setTimeout(() => { errorMsg.style.color = ""; }, 5000);
        } catch (error) {
            handleAuthError(error);
        }
    });
}

if(btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            await signOut(auth);
            if(emailForm) emailForm.reset();
            window.location.reload();
        } catch (error) {
            console.error("Błąd wylogowania", error);
        }
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.body.classList.add('is-logged-in');
        document.body.classList.remove('is-logged-out');

        userToken = await user.getIdToken();

        let displayName = user.displayName || user.email.split('@')[0];
        if(userNameSpan) userNameSpan.innerText = displayName;
        if(userAvatarImg) {
            userAvatarImg.src = user.photoURL || `https://ui-avatars.com/api/?name=${displayName}&background=61afef&color=fff`;
            userAvatarImg.style.display = 'block';
        }

        if (!user.emailVerified) {
            if(verificationBadge) verificationBadge.classList.remove('hidden');
            if(verificationWarning) verificationWarning.classList.remove('hidden');
        } else {
            if(verificationBadge) verificationBadge.classList.add('hidden');
            if(verificationWarning) verificationWarning.classList.add('hidden');
        }

        if(loginContainer) loginContainer.classList.add('hidden');
        if(userStatusCard) userStatusCard.classList.remove('hidden');

        window.dispatchEvent(new Event('user-logged-in'));

    } else {
        document.body.classList.remove('is-logged-in');
        document.body.classList.add('is-logged-out');

        userToken = null;
        if(loginContainer) loginContainer.classList.remove('hidden');
        if(userStatusCard) userStatusCard.classList.add('hidden');
        window.dispatchEvent(new Event('user-logged-out'));
    }
});

if(resendVerBtn) {
    resendVerBtn.addEventListener('click', async () => {
        if(auth.currentUser && !auth.currentUser.emailVerified) {
            try {
                await sendEmailVerification(auth.currentUser);
                alert("Link wysłany ponownie!");
            } catch(e) {
                if(e.code === 'auth/too-many-requests') alert("Poczekaj chwilę przed ponownym wysłaniem.");
            }
        }
    });
}

if(toggleSettingsBtn) {
    toggleSettingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });
}

if(btnChangeEmail) {
    btnChangeEmail.addEventListener('click', async () => {
        const newEmail = newEmailInput.value;
        if(!newEmail) return;

        settingsMsg.className = "settings-msg";
        settingsMsg.innerText = "Przetwarzanie...";

        if(auth.currentUser) {
            try {
                await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
                settingsMsg.className = "settings-msg success";
                settingsMsg.innerText = "Wysłano link weryfikacyjny na nowy adres. Kliknij go, aby zmienić email.";
                newEmailInput.value = '';
            } catch (error) {
                settingsMsg.className = "settings-msg error";
                if(error.code === 'auth/requires-recent-login') {
                    settingsMsg.innerText = "Dla bezpieczeństwa musisz się wylogować i zalogować ponownie, aby zmienić email.";
                } else if (error.code === 'auth/email-already-in-use') {
                    settingsMsg.innerText = "Ten email jest zajęty.";
                } else {
                    settingsMsg.innerText = "Błąd: " + error.message;
                }
            }
        }
    });
}

function handleAuthError(error) {
    console.error("Auth Error:", error.code);
    switch (error.code) {
        case 'auth/invalid-email': errorMsg.innerText = "Nieprawidłowy format email."; break;
        case 'auth/user-not-found': errorMsg.innerText = "Nie znaleziono użytkownika."; break;
        case 'auth/wrong-password': errorMsg.innerText = "Błędne hasło."; break;
        case 'auth/email-already-in-use': errorMsg.innerText = "Email jest już zajęty."; break;
        case 'auth/weak-password': errorMsg.innerText = "Hasło jest za słabe (Firebase check)."; break;
        case 'auth/invalid-credential': errorMsg.innerText = "Błędne dane."; break;
        case 'auth/too-many-requests': errorMsg.innerText = "Za dużo prób. Spróbuj później."; break;
        default: errorMsg.innerText = "Wystąpił błąd: " + error.code;
    }
}

window.apiCall = async (url, method = "GET", body = null) => {
    if (!userToken) {
        console.warn("Próba wywołania API bez tokena (użytkownik niezalogowany).");
        return { ok: false, status: 401 };
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(url, options);

        if (response.status === 401) {
            console.error("Token wygasł lub jest nieprawidłowy.");
            return { ok: false, status: 401 };
        }

        return await response.json();
    } catch (e) {
        console.error("Network error:", e);
        throw e;
    }
};
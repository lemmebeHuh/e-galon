import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCc099wGVBrdUiWwR7lHiyRu0gBwXK2iAg",
  authDomain: "galonapp-4b039.firebaseapp.com",
  projectId: "galonapp-4b039",
  storageBucket: "galonapp-4b039.firebasestorage.app",
  messagingSenderId: "79940351595",
  appId: "1:79940351595:web:1ea56df45fc3cde461232e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    const ordersList = document.getElementById('admin-orders-list');
    let knownOrders = new Set();

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Listen to Firebase Realtime Updates
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        ordersList.innerHTML = '';

        if (snapshot.empty) {
            ordersList.innerHTML = '<p class="empty-state">Belum ada pesanan masuk.</p>';
            return;
        }

        // We fetch all orders, but we also want to notify admin if a new order arrives
        // We track known order IDs to see if there is a newly added one
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const id = change.doc.id;
                const order = change.doc.data();
                
                if (!knownOrders.has(id)) {
                    knownOrders.add(id);
                    // Prevent notification spam on first load by checking if it's recently created
                    // A simple check: if it's pending, we assume it's new (or just notify anyway if admin is open)
                    // Better approach: only notify if timestamp is very recent, but for simplicity we notify if we haven't seen it
                    if (order.status === 'pending' && 'Notification' in window && Notification.permission === 'granted') {
                        new Notification('Pesanan Baru Masuk!', { 
                            body: `${order.quantity} Galon - ${order.address}`,
                            icon: './assets/icon-192.png'
                        });
                    }
                }
            }
        });

        // Convert to array for sorting: pending first, then otw, then completed
        const ordersArray = [];
        snapshot.forEach(doc => ordersArray.push({ id: doc.id, ...doc.data() }));

        ordersArray.sort((a,b) => {
            const statusOrder = { 'pending': 1, 'otw': 2, 'completed': 3 };
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            return 0; // Already sorted by timestamp desc from query
        }).forEach(order => {
            const el = document.createElement('div');
            el.className = 'order-item';

            let badgeClass = 'pending';
            let statusText = 'Menunggu';
            if (order.status === 'otw') { badgeClass = 'otw'; statusText = 'Sedang Dikirim'; }
            else if (order.status === 'completed') { badgeClass = 'completed'; statusText = 'Selesai'; }

            let dateStr = 'Baru Saja';
            if (order.timestamp) {
                dateStr = order.timestamp.toDate ? order.timestamp.toDate().toLocaleString('id-ID') : new Date(order.timestamp).toLocaleString('id-ID');
            }

            el.innerHTML = `
                <div class="order-header">
                    <span class="order-id">#${order.id.substring(0,8)}</span>
                    <span class="order-date">${dateStr}</span>
                </div>
                <div class="order-details">
                    <div><strong>${order.quantity} Galon</strong></div>
                    <div class="order-address">📍 ${order.address}</div>
                </div>
                <div><span class="badge ${badgeClass}">${statusText}</span></div>
                
                ${order.status !== 'completed' ? `
                <div class="admin-actions">
                    ${order.status === 'pending' ? `<button class="btn-action btn-send" data-id="${order.id}">🚚 Kirim</button>` : ''}
                    ${order.status === 'otw' ? `<button class="btn-action btn-done" data-id="${order.id}">✅ Tiba</button>` : ''}
                </div>
                ` : ''}
            `;
            ordersList.appendChild(el);
        });

        attachActionListeners();
    });

    function attachActionListeners() {
        const btnSends = document.querySelectorAll('.btn-send');
        const btnDones = document.querySelectorAll('.btn-done');

        btnSends.forEach(btn => btn.addEventListener('click', (e) => updateStatus(e.target.dataset.id, 'otw')));
        btnDones.forEach(btn => btn.addEventListener('click', (e) => updateStatus(e.target.dataset.id, 'completed')));
    }

    async function updateStatus(orderId, newStatus) {
        try {
            const orderRef = doc(db, "orders", orderId);
            await updateDoc(orderRef, {
                status: newStatus
            });
            // Firebase onSnapshot will automatically re-render the UI and notify the user
        } catch (error) {
            console.error("Error updating status: ", error);
            alert("Gagal mengubah status. Periksa koneksi Anda.");
        }
    }
});

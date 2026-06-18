import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
    const quantityEl = document.getElementById('quantity');
    const addressEl = document.getElementById('address');
    const btnIncrease = document.getElementById('btn-increase');
    const btnDecrease = document.getElementById('btn-decrease');
    const btnOrder = document.getElementById('btn-order');
    const btnOrderAgain = document.getElementById('btn-order-again');
    const productSection = document.getElementById('product-section');
    const statusMessage = document.getElementById('status-message');
    const historyList = document.getElementById('history-list');

    let quantity = 1;
    let previousOrders = {};
    let maps = {};
    let markers = {};

    // Request Notification permission immediately on load
    if ('Notification' in window && Notification.permission === 'default') {
        // Some browsers may require user interaction to show this prompt.
        // If this silently fails, it will be caught again when they click order.
        Notification.requestPermission().then(permission => {
            console.log('Notification permission:', permission);
        });
    }

    // Register SW
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => console.error(err));
        });
    }

    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function showNotification(title, body) {
        if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, { body: body, icon: './assets/icon-192.png' });
            });
        } else if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: body, icon: './assets/icon-192.png' });
        }
    }

    // Listen to Firebase Realtime Updates
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        historyList.innerHTML = '';
        
        if (snapshot.empty) {
            historyList.innerHTML = '<p class="empty-state">Belum ada pesanan.</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const order = doc.data();
            const id = doc.id;
            
            // Trigger Notification if status changed
            if (previousOrders[id] && previousOrders[id] !== order.status) {
                let title = 'Update Pesanan';
                let body = 'Status pesanan Anda telah diperbarui.';
                if (order.status === 'otw') {
                    title = 'Pesanan Dikirim! 🚚';
                    body = `Pesanan galon Anda sedang dalam perjalanan menuju ${order.address}.`;
                } else if (order.status === 'completed') {
                    title = 'Pesanan Tiba! ✅';
                    body = `Galon Anda telah sampai di lokasi. Terima kasih!`;
                }
                showNotification(title, body);
            }
            // Save current status for future comparison
            previousOrders[id] = order.status;

            // Render History Item
            const el = document.createElement('div');
            el.className = 'order-item';
            
            let badgeClass = 'pending';
            let statusText = 'Menunggu';
            if (order.status === 'otw') { badgeClass = 'otw'; statusText = 'Sedang Dikirim'; }
            else if (order.status === 'completed') { badgeClass = 'completed'; statusText = 'Selesai'; }

            // Handle timestamp format (Firebase Timestamp or fallback)
            let dateStr = 'Baru Saja';
            if (order.timestamp) {
                dateStr = order.timestamp.toDate ? order.timestamp.toDate().toLocaleString('id-ID') : new Date(order.timestamp).toLocaleString('id-ID');
            }

            el.innerHTML = `
                <div class="order-header">
                    <span class="order-id">#${id.substring(0,8)}</span>
                    <span class="order-date">${dateStr}</span>
                </div>
                <div class="order-details">
                    <div><strong>${order.quantity} Galon</strong></div>
                    <div class="order-address">📍 ${order.address}</div>
                </div>
                <div><span class="badge ${badgeClass}">${statusText}</span></div>
                ${order.status === 'otw' ? `
                <div class="map-wrapper" id="map-wrapper-${id}">
                    <div class="live-indicator"><div class="live-dot"></div> LIVE</div>
                    <div id="map-${id}" class="map-container"></div>
                </div>
                ` : ''}
            `;
            historyList.appendChild(el);
        });

        // Initialize or update maps
        snapshot.forEach((doc) => {
            const order = doc.data();
            const id = doc.id;
            
            if (order.status === 'otw' && order.driverLocation) {
                const lat = order.driverLocation.lat;
                const lng = order.driverLocation.lng;
                const mapId = `map-${id}`;
                
                // Ensure the DOM element exists before initializing map
                const mapContainer = document.getElementById(mapId);
                if (mapContainer) {
                    if (!maps[id]) {
                        maps[id] = L.map(mapId).setView([lat, lng], 16);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '&copy; OpenStreetMap',
                            maxZoom: 19
                        }).addTo(maps[id]);
                        
                        // Custom driver icon
                        const driverIcon = L.icon({
                            iconUrl: './assets/icon-192.png',
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        });
                        markers[id] = L.marker([lat, lng], {icon: driverIcon}).addTo(maps[id]);
                    } else {
                        // Update existing map and marker smoothly
                        markers[id].setLatLng([lat, lng]);
                        maps[id].panTo([lat, lng]);
                    }
                }
            } else if (order.status !== 'otw' && maps[id]) {
                // Cleanup map if status is no longer otw
                maps[id].remove();
                delete maps[id];
                delete markers[id];
            }
        });
    });

    // Button Listeners
    btnOrder.addEventListener('click', async () => {
        const address = addressEl.value.trim();
        if (!address) {
            alert('Harap isi alamat pengiriman!');
            addressEl.focus();
            return;
        }

        requestNotificationPermission();

        btnOrder.textContent = 'Memproses...';
        btnOrder.disabled = true;

        try {
            await addDoc(collection(db, "orders"), {
                quantity: quantity,
                address: address,
                status: 'pending',
                timestamp: serverTimestamp()
            });

            productSection.classList.add('hidden');
            statusMessage.classList.remove('hidden');
            addressEl.value = '';
            quantity = 1;
            quantityEl.textContent = quantity;

            showNotification('Pesanan Berhasil! 🎉', 'Pesanan masuk ke antrean dan segera diproses admin.');
        } catch (e) {
            console.error("Error adding document: ", e);
            alert("Gagal memproses pesanan. Periksa koneksi internet Anda.");
        } finally {
            btnOrder.textContent = 'Pesan Sekarang';
            btnOrder.disabled = false;
        }
    });

    btnIncrease.addEventListener('click', () => { if (quantity < 10) { quantity++; quantityEl.textContent = quantity; } });
    btnDecrease.addEventListener('click', () => { if (quantity > 1) { quantity--; quantityEl.textContent = quantity; } });
    btnOrderAgain.addEventListener('click', () => { statusMessage.classList.add('hidden'); productSection.classList.remove('hidden'); });
});

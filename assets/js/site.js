(function () {
  'use strict';
  const STORAGE_KEY = 'almatyRestaurantBookingsV1';

  function readBookings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function saveBookings(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
  function makeDateTime(date, time) {
    return new Date(date + 'T' + time + ':00').getTime();
  }
  function showReminder(booking) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const title = 'Напоминание о бронировании';
    const body = 'Завтра в ' + booking.time + ' вас ждут в ресторане ' + booking.restaurant + '. Гостей: ' + booking.guests + '.';
    try {
      const notification = new Notification(title, { body: body, icon: 'assets/images/logo5.png', tag: 'booking-' + booking.id });
      notification.onclick = function () { window.focus(); notification.close(); };
      return true;
    } catch (_) {
      // Some browsers require notifications to be displayed by a service worker.
      if (navigator.serviceWorker) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body: body, icon: 'assets/images/logo5.png', tag: 'booking-' + booking.id })).catch(function(){});
        return true;
      }
      return false;
    }
  }
  function checkReminders() {
    const items = readBookings();
    const now = Date.now();
    let changed = false;
    items.forEach(function (booking) {
      const appointment = makeDateTime(booking.date, booking.time);
      const reminderAt = appointment - 24 * 60 * 60 * 1000;
      if (!booking.reminderSent && now >= reminderAt && now < appointment) {
        if (showReminder(booking)) {
          booking.reminderSent = true;
          changed = true;
        }
      }
    });
    if (changed) saveBookings(items);
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () {});
    });
  }
  checkReminders();
  window.setInterval(checkReminders, 60000);

  const form = document.getElementById('booking-form');
  if (form) {
    const dateInput = document.getElementById('booking-date');
    const success = document.getElementById('booking-success');
    const error = document.getElementById('booking-error');
    const restaurantSelect = document.getElementById('restaurant');
    const queryRestaurant = new URLSearchParams(window.location.search).get('restaurant');
    if (queryRestaurant && restaurantSelect) {
      const match = Array.from(restaurantSelect.options).find(option => option.value.toLowerCase() === queryRestaurant.toLowerCase());
      if (match) restaurantSelect.value = match.value;
    }

    function todayLocal() {
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 10);
    }
    dateInput.min = todayLocal();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      success.hidden = true;
      error.hidden = true;
      const formData = new FormData(form);
      const date = String(formData.get('date') || '');
      const time = String(formData.get('time') || '');
      const appointment = makeDateTime(date, time);
      if (!form.checkValidity() || !appointment || appointment <= Date.now()) {
        error.hidden = false;
        if (!form.checkValidity()) form.reportValidity();
        else dateInput.focus();
        return;
      }

      const items = readBookings();
      const booking = {
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
        restaurant: String(formData.get('restaurant')),
        name: String(formData.get('name')).trim(),
        phone: String(formData.get('phone')).trim(),
        date: date,
        time: time,
        guests: String(formData.get('guests')),
        comment: String(formData.get('comment') || '').trim(),
        createdAt: Date.now(),
        reminderSent: false
      };
      items.push(booking);
      saveBookings(items);
      success.textContent = 'Бронирование сохранено на этом устройстве: ' + booking.restaurant + ', ' + booking.date + ' в ' + booking.time + '. Это учебная демонстрация — ресторан не получил заявку.';
      success.hidden = false;
      form.reset();
      dateInput.min = todayLocal();
      renderBookings();
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    const notifyButton = document.getElementById('enable-notifications');
    if (notifyButton) {
      notifyButton.addEventListener('click', async function () {
        if (!('Notification' in window)) {
          alert('Этот браузер не поддерживает уведомления. Попробуйте актуальный Chrome или Edge.');
          return;
        }
        if (!window.isSecureContext) {
          alert('Для уведомлений откройте сайт через HTTPS (или localhost во время разработки).');
          return;
        }
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            alert('Уведомления разрешены. Напоминание проверяется, когда сайт открыт или вы снова его открываете.');
            checkReminders();
          } else {
            alert('Разрешение не выдано. Разрешите уведомления для сайта в настройках браузера.');
          }
        } catch (_) {
          alert('Не удалось запросить разрешение на уведомления в этом браузере.');
        }
      });
    }

    const showButton = document.getElementById('show-bookings');
    const bookingsBox = document.getElementById('my-bookings');
    if (showButton && bookingsBox) {
      showButton.addEventListener('click', function () {
        bookingsBox.hidden = !bookingsBox.hidden;
        if (!bookingsBox.hidden) renderBookings();
      });
    }

    function renderBookings() {
      const list = document.getElementById('booking-list-items');
      if (!list) return;
      const items = readBookings().sort((a,b) => makeDateTime(a.date,a.time) - makeDateTime(b.date,b.time));
      list.replaceChildren();
      if (!items.length) {
        const p = document.createElement('p');
        p.textContent = 'На этом устройстве пока нет сохранённых бронирований.';
        list.appendChild(p);
        return;
      }
      items.forEach(function (booking) {
        const card = document.createElement('article');
        card.className = 'booking-item';
        const title = document.createElement('strong');
        title.textContent = booking.restaurant + ' — ' + booking.date + ', ' + booking.time;
        const details = document.createElement('p');
        details.textContent = booking.name + ' · ' + booking.guests + ' гостей · ' + booking.phone + (booking.comment ? ' · ' + booking.comment : '');
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-outline-secondary btn-sm';
        remove.textContent = 'Удалить';
        remove.addEventListener('click', function () {
          saveBookings(readBookings().filter(item => item.id !== booking.id));
          renderBookings();
        });
        card.append(title, details, remove);
        list.appendChild(card);
      });
    }
    renderBookings();
  }
})();
/**
 * VenueIQ — Emergency Module
 * Incident management, evacuation map, mass communication,
 * and Firebase Realtime Database emergency reporting.
 * @module emergency
 */

'use strict';

window.VenueIQ = window.VenueIQ || {};

window.VenueIQ.Emergency = (() => {

  const { Security, DataStore, Charts, Utils } = window.VenueIQ;
  const { $, formatRelativeTime } = Utils;

  let _isInitialized = false;

  const init = () => {
    if (_isInitialized) { refresh(); return; }
    _isInitialized = true;

    renderIncidents();
    renderEvacuationMap();
    renderEmergencyContacts();
    initEvacuationTrigger();

    DataStore.subscribe('incidents', renderIncidents);
  };

  const refresh = () => {
    renderIncidents();
    renderEvacuationMap();
  };

  /* ------------------------------------------------------------------ */
  /*  Incidents                                                           */
  /* ------------------------------------------------------------------ */
  const renderIncidents = () => {
    const container = $('#incidents-list');
    if (!container) return;
    container.innerHTML = '';

    const incidents = DataStore.get('incidents') ?? [];
    if (!incidents.length) {
      const empty = Security.createElement('div');
      empty.style.cssText = 'text-align:center;padding:24px;color:var(--color-success);font-size:var(--text-sm);';
      empty.textContent = '✓ No active incidents';
      container.appendChild(empty);
      return;
    }

    incidents.forEach(inc => {
      const item = Security.createElement('div', {
        class: 'incident-item',
        role: 'listitem',
        'aria-label': `${inc.severity} incident: ${inc.title} at ${inc.location}`,
      });

      const icon = Security.createElement('span', { class: 'incident-icon', 'aria-hidden': 'true' }, [inc.icon]);
      const info = Security.createElement('div', { class: 'incident-info' });
      const hdr  = Security.createElement('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' });
      const title= Security.createElement('span', { class: 'incident-title', textContent: inc.title });
      const sev  = Security.createElement('span', {
        class: `incident-severity severity-${inc.severity}`,
        textContent: inc.severity.toUpperCase(),
        'aria-label': `Severity: ${inc.severity}`,
      });
      const loc  = Security.createElement('div', { class: 'incident-location', textContent: `📍 ${inc.location}` });
      const time = Security.createElement('div', { class: 'incident-time', textContent: formatRelativeTime(inc.time) });

      const actions = Security.createElement('div', { style: 'display:flex;gap:6px;margin-top:8px;' });
      const resolveBtn = Security.createElement('button', {
        class: 'btn btn-secondary btn-sm',
        'aria-label': `Resolve incident: ${inc.title}`,
      }, ['✓ Resolve']);
      const dispatchBtn = Security.createElement('button', {
        class: 'btn btn-primary btn-sm',
        'aria-label': `Dispatch team for: ${inc.title}`,
      }, ['Dispatch Team']);

      resolveBtn.addEventListener('click',  () => resolveIncident(inc.id));
      dispatchBtn.addEventListener('click', () => dispatchTeam(inc));

      actions.append(resolveBtn, dispatchBtn);
      hdr.append(title, sev);
      info.append(hdr, loc, time, actions);
      item.append(icon, info);
      container.appendChild(item);
    });
  };

  const resolveIncident = (id) => {
    const incidents = DataStore.get('incidents').filter(i => i.id !== id);
    DataStore.set('incidents', incidents);
    DataStore.set('stats.activeIncidents', incidents.length);
    window.VenueIQ.showToast?.({ title: 'Incident Resolved', message: 'Incident marked as resolved and closed.', type: 'success' });
    window.VenueIQ.announceToScreenReader?.('Incident resolved and removed from active list.');
    typeof gtag !== 'undefined' && gtag('event', 'incident_resolved', { incident_id: id });
  };

  const dispatchTeam = (incident) => {
    window.VenueIQ.showToast?.({
      title: '🚨 Team Dispatched',
      message: `Response team en route to ${incident.location}`,
      type: 'danger',
      duration: 5000,
    });
    window.VenueIQ.announceToScreenReader?.(`Emergency team dispatched to ${incident.location}`);
    typeof gtag !== 'undefined' && gtag('event', 'team_dispatched', { location: incident.location });
  };

  /* ------------------------------------------------------------------ */
  /*  Evacuation Map                                                      */
  /* ------------------------------------------------------------------ */
  const renderEvacuationMap = () => {
    const canvas = $('#evacuation-map');
    if (!canvas) return;
    Charts.drawEvacuationMap(canvas);
  };

  /* ------------------------------------------------------------------ */
  /*  Emergency Contacts                                                  */
  /* ------------------------------------------------------------------ */
  const renderEmergencyContacts = () => {
    const container = $('#emergency-contacts');
    if (!container) return;
    container.innerHTML = '';

    const contacts = DataStore.get('emergencyContacts') ?? [];
    contacts.forEach(contact => {
      const item = Security.createElement('div', { class: 'contact-item', role: 'listitem' });
      const icon = Security.createElement('span', { class: 'contact-icon', 'aria-hidden': 'true' }, [contact.icon]);
      const info = Security.createElement('div', { class: 'contact-info' });
      const name = Security.createElement('div', { class: 'contact-name', textContent: contact.name });
      const role = Security.createElement('div', { class: 'contact-role', textContent: contact.role });
      const callLink = Security.createElement('a', {
        class: 'contact-call',
        href: `tel:${encodeURIComponent(contact.phone)}`,
        'aria-label': `Call ${contact.name} at ${contact.phone}`,
      }, ['📞 ' + contact.phone]);

      info.append(name, role);
      item.append(icon, info, callLink);
      container.appendChild(item);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Evacuation Trigger                                                  */
  /* ------------------------------------------------------------------ */
  const initEvacuationTrigger = () => {
    const btn = $('#trigger-evacuation');
    if (!btn) return;

    let _confirmState = false;
    let _confirmTimer = null;

    btn.addEventListener('click', () => {
      if (!Security.checkRateLimit('evacuation', 1, 300000)) {
        window.VenueIQ.showToast?.({ title: 'Cooldown', message: 'Evacuation alert on cooldown.', type: 'warning' });
        return;
      }

      if (!_confirmState) {
        // First click — ask for confirmation
        _confirmState = true;
        btn.textContent = '⚠ CONFIRM EVACUATION? (click again)';
        btn.style.animation = 'none';
        btn.style.background = 'hsl(38,95%,54%)';
        _confirmTimer = setTimeout(() => {
          _confirmState = false;
          btn.textContent = '🚨 Trigger Evacuation';
          btn.style.background = '';
          btn.style.animation = '';
        }, 5000);
      } else {
        // Second click — execute
        clearTimeout(_confirmTimer);
        _confirmState = false;
        triggerEvacuation(btn);
      }
    });
  };

  const triggerEvacuation = (btn) => {
    btn.disabled = true;
    btn.textContent = '🚨 EVACUATION IN PROGRESS';
    btn.style.background = 'var(--color-danger)';
    btn.style.animation = 'none';

    // Add critical incident
    const incidents = DataStore.get('incidents');
    DataStore.set('incidents', [{
      id: 'evac-001',
      type: 'evacuation',
      title: '🚨 FULL VENUE EVACUATION INITIATED',
      location: 'All Zones — All Sections',
      severity: 'critical',
      status: 'active',
      time: Date.now(),
      icon: '🚨',
    }, ...incidents]);

    window.VenueIQ.showToast?.({
      title: '🚨 EVACUATION ACTIVATED',
      message: 'All exits open. PA system broadcasting. Attendees being directed to assembly points.',
      type: 'danger',
      duration: 0,
    });
    window.VenueIQ.announceToScreenReader?.(
      'CRITICAL ALERT: Full venue evacuation has been initiated. All attendees must proceed to nearest exit immediately.',
      'assertive'
    );
    // GA4
    typeof gtag !== 'undefined' && gtag('event', 'evacuation_triggered', { venue: 'MetroArena' });
    // Firebase Analytics + Realtime Database
    window.VenueIQ.FirebaseService?.logEvent('evacuation_triggered', {
      venue: 'MetroArena Stadium',
      zone: 'all',
      severity: 'critical',
    });
    window.VenueIQ.FirebaseService?.reportEmergency?.({
      type: 'evacuation',
      zone: 'all',
      description: 'Full venue evacuation initiated by operator.',
    });
    window.VenueIQ.FirebaseService?.pushAlert?.({
      title: 'EVACUATION ACTIVATED',
      message: 'Full venue evacuation initiated. All zones.',
      severity: 'critical',
    });
  };

  return Object.freeze({ init, refresh });

})();

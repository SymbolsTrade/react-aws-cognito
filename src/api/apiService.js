const API_BASE_URL = 'https://api.amis-center.com/api/v1/';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    const currentUser = localStorage.getItem('user_id');
    this.userId = currentUser ? currentUser.id : null;
  }

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('auth_access_token');
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`,
        //'X-Token': '03a2788b-ed5a-404d-9a48-78d8fe45598d',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      ...options
    };

    const dt = Date.now();
    let url = `${this.baseURL}${endpoint}`;
    if (url.includes('?')) {
      url += `&dt=${dt}`;
    } else {
      url += `?dt=${dt}`;
    }
    
    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      // For DELETE requests, there might not be a body
      if (response.status === 204) {
          return null;
      }
      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  setUserId(theNewUserId) {
    this.userId = theNewUserId;
  }

  async checkIn(userData) {
    //if the user just created from AWS cognito, we need to check in the user to DB
    //if user simply login, we keep the token information
    //so this function is upsert database
    try {
      const dataToSend = { requestType: 'userCheckIn', data: userData };
      const response = await this.request('db/note-user/from-aws', {
        method: 'POST',
        body: JSON.stringify(dataToSend)
      });
      return response;
    } catch (error) {
      console.error('Error checking in user:', error);
      throw error;
    }
  }

  async getNotesInFolder(p_userId=null, folderId=null) {
    const userId = p_userId || this.userId;
    return this.request(`multi/notes/for-user/read?user_id=${userId}&folder_id=${folderId}`);
  }
  async searchNotesInFolder(userId, folderId, query, currentNotesList=null) {
    const q = (query || '').toLowerCase().trim()
    const rows = currentNotesList? currentNotesList : await this.getNotesInFolder(userId, folderId)
    if (!q) return rows
    const terms = q.split(/\s+/).filter(Boolean)
    return rows.filter(n => {
      const hay = [n.title?.toLowerCase()||'', n.content?.toLowerCase()||''].join(' ')
      return terms.every(t => hay.includes(t))
    })
  }
  async createNote(noteId, userId, folderId, note) {
    const n = {
          id: noteId,
          user_id: userId,
          folder_id: folderId,
          title: note?.title?.trim() || 'Untitled',
          content: note?.content || ''
        }
    const dataToSend = { requestType: 'notes-add', data: n };
    return await this.request('db/notes-add/notes', {
      method: 'POST',
      body: JSON.stringify(dataToSend)
    });
  }
  async updateNote(userId, folderId, noteId, note) {
    const dataToSend = { requestType: 'update', data: { ...note, id: noteId, user_id: userId, folder_id: folderId } };
    return await this.request('db/notes-put/notes', {
      method: 'POST',
      body: JSON.stringify(dataToSend)
    });
  }
  async createBulkNotes(userId, folderId, notesArray) {
    const dataToSend = { requestType: 'createBulk', data: notesArray.map(tx => ({ ...tx, user_id: userId, folder_id: folderId })) };
    return this.request('bulk/notes-add/notes', {
      method: 'POST',
      body: JSON.stringify(dataToSend)
    });
  }

  async getFolders(p_userId=null) {
    const userId = p_userId || this.userId;
    return this.request(`multi/notes/folders/read?user_id=${userId}`);
  }

  async createFolder(data) {
    const dataToSend = { requestType: 'notes-add', data:  { ...data, user_id: this.userId } };
    return this.request('db/notes-add/folders', {
      method: 'POST',
      body: JSON.stringify(dataToSend)
    });
  }

  async updateFolder(id, data) {
    const dataToSend = { requestType: 'update', data: { ...data, id } };
    return this.request('db/notes-put/folders', {
      method: 'POST',
      body: JSON.stringify(dataToSend)
    });
  }

  /** Normalize Date | number | string -> 'YYYY-MM-DD HH:mm:ss' (server-friendly TIMESTAMP) */
  toSQLTimestamp(value) {
    if (!value) return null;
    const d = (value instanceof Date) ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    // Send UTC; adjust if your API expects local server time
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }

  /** Map UI recurrence -> DB params (nulls mean "no change" or "not set") */
  toDbRecurrence(recur, {forUpdate=false} = {}) {
    if (!recur || recur.freq === 'NONE') {
      return {
        recurrence_freq: forUpdate ? null : null,
        recurrence_interval: forUpdate ? null : null,
        recurrence_by_weekday: forUpdate ? null : null,
        recurrence_until: forUpdate ? null : null,
      };
    }
    const freq = String(recur.freq || '').toUpperCase();
    const interval = Math.max(1, parseInt(recur.interval || 1, 10));
    return {
      recurrence_freq: freq,
      recurrence_interval: interval,
      recurrence_by_weekday: Array.isArray(recur.byWeekday)
        ? JSON.stringify(recur.byWeekday) // MySQL JSON param
        : null,
      recurrence_until: recur.untilISO ? this.toSQLTimestamp(recur.untilISO) : null,
    };
  }

  /** List master events (no client-side expansion) */
  async getEvents(userId = null, startFrom = null, startTo = null) {
    const uid = userId || this.userId;
    const qs = new URLSearchParams();
    if (uid) qs.set('user_id', uid);
    if (startFrom) qs.set('start_from', this.toSQLTimestamp(startFrom));
    if (startTo) qs.set('start_to', this.toSQLTimestamp(startTo));
    const qsStr = qs.toString();
    return this.request(`multi/notes/events/read${qsStr ? `?${qsStr}` : ''}`);
  }

  /** Create a single event row (recurrence fields optional) */
  async createEvent(eventId, userId, evt) {
    const payload = {
      id: eventId,
      user_id: userId || this.userId,
      title: (evt?.title || 'Untitled event').trim(),
      notes: evt?.notes ?? '',
      location: evt?.location ?? '',
      start_at: this.toSQLTimestamp(evt?.start_at || evt?.startAt || evt?.startAtISO || evt?.datetime),
      reminder_dismissed: evt?.reminder_dismissed ?? 0,
      ...this.toDbRecurrence(evt?.recurrence),
    };
    const dataToSend = { requestType: 'events-add', data: payload };
    return this.request('db/notes-add/events', {
      method: 'POST',
      body: JSON.stringify(dataToSend),
    });
  }

  /** Update an event (send nulls to leave fields unchanged via IFNULL in SQL) */
  async updateEvent(id, patch = {}) {
    const payload = {
      id,
      title: patch.title ?? null,
      notes: patch.notes ?? null,
      location: patch.location ?? null,
      start_at: (patch.start_at || patch.startAt || patch.startAtISO)
        ? this.toSQLTimestamp(patch.start_at || patch.startAt || patch.startAtISO)
        : null,
      reminder_dismissed: (patch.reminder_dismissed ?? null),
      ...this.toDbRecurrence(patch.recurrence, { forUpdate: true }),
    };
    const dataToSend = { requestType: 'update', data: payload };
    return this.request('db/notes-put/events', {
      method: 'POST',
      body: JSON.stringify(dataToSend),
    });
  }

  /** Delete an event by id */
  async deleteEvent(id) {
    const dataToSend = { requestType: 'delete', data: { id } };
    return this.request('db/notes-del/events', {
      method: 'POST',
      body: JSON.stringify(dataToSend),
    });
  }

  /** Reminders due now (server-side). Falls back to client-side if API not wired yet. */
  async getReminders(userId = null) {
    const uid = userId || this.userId;
    const qs = new URLSearchParams();
    if (uid) qs.set('user_id', uid);
    const qsStr = qs.toString();
    try {
      return await this.request(`multi/notes/events-reminders/read${qsStr ? `?${qsStr}` : ''}`);
    } catch (e) {
      // Fallback: compute on client for next 24h using occurrences
      // return this.getUpcomingOccurrences({ userId: uid, days: 1 })
      //   .then(occs => {
      //     const now = Date.now();
      //     return occs.filter(o => new Date(o.reminderAtISO).getTime() <= now);
      //   });
      console.log('Error fetching reminders:', e);
    }
  }

  /* ============== Client-side recurrence helpers (optional) ============== */


  /** Convenience: mark an entire event as dismissed (series-level) */
  async dismissEventReminder(id) {
    return this.updateEvent(id, { reminder_dismissed: 1 });
  }
}

export const apiService = new ApiService();
export default apiService;
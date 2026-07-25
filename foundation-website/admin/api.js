// API Helper - connects admin panel to live website via PHP backend
const API_URL = '/admin/api.php';

const DataAPI = {
  async save(type, data) {
    try {
      const res = await fetch(API_URL + '?action=save&type=' + type, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      console.error('Save failed:', e);
      // Fallback to localStorage
      localStorage.setItem(type, JSON.stringify(data));
      return { success: true, fallback: true };
    }
  },

  async load(type) {
    try {
      const res = await fetch(API_URL + '?action=load&type=' + type);
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Load failed:', e);
      // Fallback to localStorage
      return JSON.parse(localStorage.getItem(type) || '[]');
    }
  },

  async loadAll() {
    try {
      const res = await fetch(API_URL + '?action=getAll');
      return await res.json();
    } catch (e) {
      console.error('LoadAll failed:', e);
      return {};
    }
  }
};

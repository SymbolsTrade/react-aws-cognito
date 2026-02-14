import { useEffect, useState } from 'react';
import apiService from '../api/apiService.js';

export default function DbApiManager() {
  const [folders, setFolders] = useState([]); // api_id list
  const [selectedFolder, setSelectedFolder] = useState(null); // api_id
  const [items, setItems] = useState([]); // api_group list for selected api_id
  const [selectedItem, setSelectedItem] = useState(null); // api_group
  const [form, setForm] = useState({
    api_id: '',
    api_group: '',
    skill_lvl: '',
    sql_text: '',
    sql_type: '',
    conn_str_name: '',
    param_default: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch all api_id (folders)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Adjust endpoint as needed
        const res = await apiService.request('multi/apientries/folders/read');
        setFolders(res.map(r => r.api_id));
      } catch (e) {
        setMessage('Failed to load folders');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch all api_group (items) for selected api_id
  useEffect(() => {
    if (!selectedFolder) return;
    (async () => {
      setLoading(true);
      try {
        // Adjust endpoint as needed
        const res = await apiService.request(`multi/apientries/group-items/read?api_id=${encodeURIComponent(selectedFolder)}`);
        setItems(res.map(r => r.api_group));
      } catch (e) {
        setMessage('Failed to load items');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedFolder]);

  // Fetch item details for selected api_id + api_group
  useEffect(() => {
    if (!selectedFolder || !selectedItem) return;
    (async () => {
      setLoading(true);
      try {
        // Adjust endpoint as needed
        const res = await apiService.request(`multi/apientries/group-items/read?api_id=${encodeURIComponent(selectedFolder)}&api_group=${encodeURIComponent(selectedItem)}`);
        const entry = Array.isArray(res) ? res[0] : res;
        setForm({
          api_id: selectedFolder,
          api_group: selectedItem,
          skill_lvl: entry.skill_lvl || '',
          sql_text: entry.sql_text || '',
          sql_type: entry.sql_type || '',
          conn_str_name: entry.conn_str_name || '',
          param_default: entry.param_default ? JSON.stringify(entry.param_default, null, 2) : '',
        });
      } catch (e) {
        setMessage('Failed to load item details');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedFolder, selectedItem]);

  // Handle form changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };


  // Save (update) item
  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      const dataToSend = {
        api_id: form.api_id,
        api_group: form.api_group,
        skill_lvl: parseInt(form.skill_lvl, 10) || null,
        sql_text: form.sql_text,
        sql_type: form.sql_type,
        conn_str_name: form.conn_str_name,
        param_default: form.param_default ? JSON.parse(form.param_default) : null,
      };
      await apiService.request('db/apientries/update', {
        method: 'POST',
        body: JSON.stringify({ requestType: 'update', data: dataToSend })
      });
      setMessage('Saved successfully!');
    } catch (e) {
      setMessage('Save failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Add new item (allow new api_id and api_group)
  const handleAdd = async () => {
    setLoading(true);
    setMessage('');
    try {
      const dataToSend = {
        api_id: form.api_id,
        api_group: form.api_group,
        skill_lvl: parseInt(form.skill_lvl, 10) || null,
        sql_text: form.sql_text,
        sql_type: form.sql_type,
        conn_str_name: form.conn_str_name,
        param_default: form.param_default ? JSON.parse(form.param_default) : null,
      };
      await apiService.request('db/apientries/new', {
        method: 'POST',
        body: JSON.stringify({ requestType: 'add', data: dataToSend })
      });
      setMessage('Added successfully!');
      // Optionally refresh folders/items
      if (!folders.includes(form.api_id)) setFolders([...folders, form.api_id]);
      if (selectedFolder === form.api_id && !items.includes(form.api_group)) setItems([...items, form.api_group]);
    } catch (e) {
      setMessage('Add failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Folders (api_id) */}
      <div className="w-1/6 border-r p-4 overflow-y-auto">
        <div className="font-bold mb-2">api_id</div>
        {folders.map(fid => (
          <div
            key={fid}
            className={`cursor-pointer p-2 rounded ${selectedFolder === fid ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            onClick={() => { setSelectedFolder(fid); setSelectedItem(null); }}
          >
            {fid}
          </div>
        ))}
        <div className="mt-4">
          <input
            className="border p-2 rounded w-full"
            placeholder="New api_id (folder)"
            value={form.api_id}
            name="api_id"
            onChange={handleChange}
          />
        </div>
      </div>
      {/* Items (api_group) */}
      <div className="w-1/6 border-r p-4 overflow-y-auto">
        <div className="font-bold mb-2">api_group</div>
        {selectedFolder && items.map(gid => (
          <div
            key={gid}
            className={`cursor-pointer p-2 rounded ${selectedItem === gid ? 'bg-green-100' : 'hover:bg-gray-100'}`}
            onClick={() => setSelectedItem(gid)}
          >
            {gid}
          </div>
        ))}
        <div className="mt-4">
          <input
            className="border p-2 rounded w-full"
            placeholder="New api_group (item)"
            value={form.api_group}
            name="api_group"
            onChange={handleChange}
          />
        </div>
      </div>
      {/* Edit Form */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="font-bold mb-2">Edit/Add db_api Entry</div>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div>
            <label className="block font-medium">skill_lvl</label>
            <input name="skill_lvl" value={form.skill_lvl} onChange={handleChange} className="border p-2 rounded w-full" type="number" />
          </div>
          <div>
            <label className="block font-medium">sql_text</label>
            <textarea name="sql_text" value={form.sql_text} onChange={handleChange} className="border p-2 rounded w-full" rows={4} />
          </div>
          <div>
            <label className="block font-medium">sql_type</label>
            <input name="sql_type" value={form.sql_type} onChange={handleChange} className="border p-2 rounded w-full" />
          </div>
          <div>
            <label className="block font-medium">conn_str_name</label>
            <input name="conn_str_name" value={form.conn_str_name} onChange={handleChange} className="border p-2 rounded w-full" />
          </div>
          <div>
            <label className="block font-medium">param_default (JSON)</label>
            <textarea name="param_default" value={form.param_default} onChange={handleChange} className="border p-2 rounded w-full" rows={3} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
            <button type="button" className="bg-green-600 text-white px-4 py-2 rounded" onClick={handleAdd}>Add New</button>
          </div>
          {loading && <div className="text-blue-600">Loading...</div>}
          {message && <div className="text-red-600">{message}</div>}
        </form>
      </div>
    </div>
  );
}

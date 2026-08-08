import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, UserPermissions, Hub } from '../types';
import { ShieldAlert, Users, Settings, Activity, Check, X, Shield, Lock } from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'crm' | 'permissions' | 'radar'>('crm');
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  const [loading, setLoading] = useState(true);

  const [permissionsForm, setPermissionsForm] = useState<UserPermissions>({
    maxParticipants: 100,
    maxQuestions: 50,
    maxDurationMinutes: 120,
    maxRooms: 5,
    canUsePictureQuestions: true,
    canUseVideoProctoring: false,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = usersSnap.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
      
      const hubsSnap = await getDocs(collection(db, 'hubs'));
      const hubsData = hubsSnap.docs.map(doc => doc.data() as Hub);
      setHubs(hubsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePromote = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
      await setDoc(doc(db, 'whitelisted_cnics', user.cnic), { cnic: user.cnic, promotedAt: new Date().toISOString() });
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Error promoting user');
    }
  };

  const handleRevoke = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: 'participant' });
      await deleteDoc(doc(db, 'whitelisted_cnics', user.cnic));
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Error revoking access');
    }
  };

  const handleSelectUserForPermissions = (user: UserProfile) => {
    setSelectedUser(user);
    if (user.permissions && typeof user.permissions === 'object' && !Array.isArray(user.permissions)) {
      setPermissionsForm({
        maxParticipants: user.permissions.maxParticipants ?? 100,
        maxQuestions: user.permissions.maxQuestions ?? 50,
        maxDurationMinutes: user.permissions.maxDurationMinutes ?? 120,
        maxRooms: user.permissions.maxRooms ?? 5,
        canUsePictureQuestions: user.permissions.canUsePictureQuestions ?? true,
        canUseVideoProctoring: user.permissions.canUseVideoProctoring ?? false,
      });
    } else {
      setPermissionsForm({
        maxParticipants: 100,
        maxQuestions: 50,
        maxDurationMinutes: 120,
        maxRooms: 5,
        canUsePictureQuestions: true,
        canUseVideoProctoring: false,
      });
    }
    setActiveTab('permissions');
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        permissions: permissionsForm
      });
      alert('Permissions updated successfully!');
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Error saving permissions');
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col p-4 md:p-8">
      <div className="max-w-6xl w-full mx-auto">
        <div className="flex items-center space-x-4 mb-8">
          <div className="p-3 bg-brand-primary/10 rounded-xl">
            <ShieldAlert className="w-8 h-8 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-brand-text">Super Admin Panel</h1>
            <p className="text-brand-text/70">System control and role-based access management.</p>
          </div>
        </div>

        <div className="flex space-x-2 mb-6 border-b border-brand-border">
          <button
            onClick={() => setActiveTab('crm')}
            className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'crm'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-text/60 hover:text-brand-text'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>User & Organizer CRM</span>
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'permissions'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-text/60 hover:text-brand-text'
            }`}
          >
            <Lock className="w-5 h-5" />
            <span>Granular Permissions</span>
          </button>
          <button
            onClick={() => setActiveTab('radar')}
            className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'radar'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-text/60 hover:text-brand-text'
            }`}
          >
            <Activity className="w-5 h-5" />
            <span>Platform Radar</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-12 h-12 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-brand-surface border border-brand-border rounded-xl shadow-lg overflow-hidden">
            {activeTab === 'crm' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-brand-bg border-b border-brand-border text-brand-text/70">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Name</th>
                      <th className="px-6 py-4 font-semibold">Email</th>
                      <th className="px-6 py-4 font-semibold">CNIC</th>
                      <th className="px-6 py-4 font-semibold">Current Role</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {users.map(user => (
                      <tr key={user.uid} className="hover:bg-brand-bg/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-brand-text">{user.name}</td>
                        <td className="px-6 py-4 text-brand-text/80">{user.email}</td>
                        <td className="px-6 py-4 text-brand-text/80">{user.cnic}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            user.role === 'admin' ? 'bg-green-500/10 text-green-500' :
                            user.role === 'super_admin' ? 'bg-purple-500/10 text-purple-500' :
                            'bg-gray-500/10 text-gray-500'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleSelectUserForPermissions(user)}
                            className="inline-flex items-center justify-center p-2 bg-brand-bg border border-brand-border rounded-lg text-brand-text/80 hover:text-brand-primary hover:border-brand-primary transition-colors"
                            title="Edit Permissions"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          {user.role !== 'admin' && user.role !== 'super_admin' && (
                            <button
                              onClick={() => handlePromote(user)}
                              className="inline-flex items-center space-x-2 px-3 py-2 bg-brand-primary/10 text-brand-primary rounded-lg hover:bg-brand-primary/20 transition-colors text-sm font-semibold"
                            >
                              <Shield className="w-4 h-4" />
                              <span>Promote to Organizer</span>
                            </button>
                          )}
                          {user.role === 'admin' && (
                            <button
                              onClick={() => handleRevoke(user)}
                              className="inline-flex items-center space-x-2 px-3 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-semibold"
                            >
                              <X className="w-4 h-4" />
                              <span>Revoke Access</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-brand-text/60">
                          No users found in the system.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'permissions' && (
              <div className="p-6">
                {!selectedUser ? (
                  <div className="text-center py-12 text-brand-text/60">
                    <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a user from the CRM to manage their granular permissions.</p>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center justify-between pb-6 border-b border-brand-border">
                      <div>
                        <h2 className="text-xl font-bold text-brand-text">Managing Permissions for:</h2>
                        <p className="text-brand-text/70">{selectedUser.name} ({selectedUser.email})</p>
                      </div>
                      <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-xs font-bold uppercase tracking-wider">
                        {selectedUser.role}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-brand-text">Max Participants</label>
                        <input
                          type="number"
                          value={permissionsForm.maxParticipants}
                          onChange={(e) => setPermissionsForm({ ...permissionsForm, maxParticipants: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-brand-text">Max Questions per Quiz</label>
                        <input
                          type="number"
                          value={permissionsForm.maxQuestions}
                          onChange={(e) => setPermissionsForm({ ...permissionsForm, maxQuestions: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-brand-text">Max Duration (Minutes)</label>
                        <input
                          type="number"
                          value={permissionsForm.maxDurationMinutes}
                          onChange={(e) => setPermissionsForm({ ...permissionsForm, maxDurationMinutes: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-brand-text">Max Rooms</label>
                        <input
                          type="number"
                          value={permissionsForm.maxRooms}
                          onChange={(e) => setPermissionsForm({ ...permissionsForm, maxRooms: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-brand-border">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissionsForm.canUsePictureQuestions}
                          onChange={(e) => setPermissionsForm({ ...permissionsForm, canUsePictureQuestions: e.target.checked })}
                          className="w-5 h-5 text-brand-primary bg-brand-bg border-brand-border rounded focus:ring-brand-primary focus:ring-offset-brand-surface"
                        />
                        <span className="font-semibold text-brand-text">Enable Picture Questions</span>
                      </label>
                      
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissionsForm.canUseVideoProctoring}
                          onChange={(e) => setPermissionsForm({ ...permissionsForm, canUseVideoProctoring: e.target.checked })}
                          className="w-5 h-5 text-brand-primary bg-brand-bg border-brand-border rounded focus:ring-brand-primary focus:ring-offset-brand-surface"
                        />
                        <span className="font-semibold text-brand-text">Enable Video Proctoring</span>
                      </label>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={handleSavePermissions}
                        className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-opacity-90 transition-all flex justify-center items-center space-x-2 shadow-lg shadow-brand-primary/20"
                      >
                        <Check className="w-5 h-5" />
                        <span>Save Subscription Limits</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'radar' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-brand-bg border-b border-brand-border text-brand-text/70">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Hub Title</th>
                      <th className="px-6 py-4 font-semibold">Organizer CNIC</th>
                      <th className="px-6 py-4 font-semibold">Start Time</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {hubs.map(hub => {
                      // Basic status logic based on presence of questions or created time
                      const status = hub.questions && hub.questions.length > 0 ? 'Live / Ready' : 'Scheduled';
                      
                      return (
                        <tr key={hub.id} className="hover:bg-brand-bg/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-brand-text">{hub.hubName}</td>
                          <td className="px-6 py-4 text-brand-text/80">{hub.id.split('-')[0] || 'Unknown'} (Hub ID: {hub.id})</td>
                          <td className="px-6 py-4 text-brand-text/80">
                            {hub.createdAt ? new Date(hub.createdAt).toLocaleDateString() : 'Unknown'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              status === 'Live / Ready' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-yellow-500/10 text-yellow-500'
                            }`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {hubs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-brand-text/60">
                          No active rooms found on the platform.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, KeyRound } from 'lucide-react';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const router = useRouter();

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;
            
            setSuccessMsg('Mot de passe mis à jour avec succès.');
            setTimeout(() => {
                router.push('/');
            }, 2000);

        } catch (err) {
            setErrorMsg('Erreur : ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F9F5F0] flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-[#D4AF37]/20">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[#F9F5F0] rounded-full flex items-center justify-center mx-auto mb-4 text-[#D4AF37]">
                        <KeyRound fill="#D4AF37" size={28} />
                    </div>
                    <h1 className="font-serif text-3xl mb-2">Nouveau mot de passe</h1>
                    <p className="text-gray-500 text-sm">
                        Définissez votre nouveau mot de passe sécurisé.
                    </p>
                </div>

                {errorMsg && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm">
                        {errorMsg}
                    </div>
                )}
                {successMsg && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-xl mb-6 text-sm">
                        {successMsg}
                    </div>
                )}

                <form onSubmit={handleUpdatePassword} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Nouveau mot de passe</label>
                        <input 
                            type="password" 
                            required
                            minLength={6}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-[#FAFAFA] border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#D4AF37] transition-colors"
                        />
                    </div>
                    
                    <button
                        type="submit"
                        disabled={loading || password.length < 6}
                        className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform bg-[#D4AF37] text-white shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Mettre à jour le mot de passe'}
                    </button>
                </form>
            </div>
        </div>
    );
}

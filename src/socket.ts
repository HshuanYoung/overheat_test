import { io } from 'socket.io-client';

const BACKEND_URL = (typeof import.meta !== 'undefined' && import.meta.env) 
    ? (import.meta.env.VITE_BACKEND_URL || '') 
    : '';


export const socket = io(BACKEND_URL, {
    autoConnect: false
});

let _authenticated = false;
socket.on('authenticated', () => {
    _authenticated = true;
});
socket.on('disconnect', () => {
    _authenticated = false;
});


export const isSocketAuthenticated = () => {
    return _authenticated;
};

export const onceAuthenticated = (callback: () => void) => {
    if (_authenticated) {
        callback();
    } else {
        socket.once('authenticated', callback);
    }
};

export const getAuthToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null;
export const setAuthToken = (token: string) => typeof window !== 'undefined' ? localStorage.setItem('token', token) : null;
export const removeAuthToken = () => typeof window !== 'undefined' ? localStorage.removeItem('token') : null;

export const getAuthUser = () => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
};
export const setAuthUser = (user: any) => typeof window !== 'undefined' ? localStorage.setItem('user', JSON.stringify(user)) : null;
export const removeAuthUser = () => typeof window !== 'undefined' ? localStorage.removeItem('user') : null;


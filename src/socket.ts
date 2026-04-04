import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const socket = io(BACKEND_URL, {
    autoConnect: false
});

export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token: string) => localStorage.setItem('token', token);
export const removeAuthToken = () => localStorage.removeItem('token');

export const getAuthUser = () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
};
export const setAuthUser = (user: any) => localStorage.setItem('user', JSON.stringify(user));
export const removeAuthUser = () => localStorage.removeItem('user');

import { io, Socket } from 'socket.io-client';

/**
 * A client for interacting with the MSTY Millionaire backend API.
 * It uses the Netlify proxy, so all requests are made to the same origin.
 */
class MSYTApiClient {
  private baseURL: string;
  private socket: Socket | null = null;

  constructor() {
    // Because of the Netlify proxy, the API URL is relative to the frontend host.
    // We don't need to expose the Railway URL to the client.
    this.baseURL = '/api';
  }

  /**
   * Fetches the latest MSTY trades from the backend.
   * In a real app, this would be enhanced with caching (e.g., using React Query).
   */
  async getLatestTrades(): Promise<any> {
    try {
      // Endpoint to get MSTY trade data needs to be created in the backend
      const response = await fetch(`${this.baseURL}/msty/trades/latest`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch latest trades:', error);
      throw error;
    }
  }

  /**
   * Subscribes to real-time trade update events from the server.
   * @param callback The function to execute when a 'trades-updated' event is received.
   */
  subscribeToTradeUpdates(callback: (data: any) => void) {
    if (!this.socket) {
      // The path option is important for Socket.io to work correctly with the Netlify proxy
      this.socket = io({ path: '/socket.io' });
    }

    this.socket.on('connect', () => {
      console.log('Socket.io connected successfully.');
    });

    this.socket.on('trades-updated', (data) => {
      console.log('Received trade update:', data);
      callback(data);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket.io disconnected.');
    });

    // Return a function to clean up the subscription
    return () => {
      this.socket?.off('trades-updated', callback);
    };
  }

  /**
   * Disconnects the Socket.io client.
   */
  disconnect() {
    this.socket?.disconnect();
  }
}

// Export a singleton instance of the client
export const apiClient = new MSYTApiClient(); 
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-create-passkey-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gray-50 px-4">
      <div class="w-full max-w-md bg-white p-8 rounded-xl shadow-md text-center">
        <h2 class="text-2xl font-bold mb-4">Create Your Passkey</h2>
        <p class="text-gray-600 mb-6">Set up a passkey for fast, secure sign-in.</p>
        <button class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700">Setup Passkey</button>
      </div>
    </div>
  `
})
export class CreatePasskeyPage {}
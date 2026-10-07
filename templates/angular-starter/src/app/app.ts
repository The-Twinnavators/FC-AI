import { Component, signal } from '@angular/core';

/** The app shell: header with the app's name and the main area where features go. */
@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('My app');
}

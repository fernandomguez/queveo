import { Component } from '@angular/core';
import { MovieList } from './movie-list/movie-list';

@Component({
  imports: [MovieList],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}

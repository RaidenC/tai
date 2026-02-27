import { Component, input } from '@angular/core';

@Component({
  selector: 'tai-hello-world',
  standalone: true,
  imports: [],
  templateUrl: './hello-world.html',
  styleUrl: './hello-world.scss',
})
export class HelloWorldComponent {
  name = input('World');
}

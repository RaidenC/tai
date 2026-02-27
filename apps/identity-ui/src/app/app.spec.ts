import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';

describe('App', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [App],
            providers: [provideRouter([])],
        }).compileComponents();
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(App);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });

    it(`should have as title 'identity-ui'`, () => {
        const fixture = TestBed.createComponent(App);
        const app = fixture.componentInstance;
        expect(app.title).toEqual('identity-ui');
    });
});

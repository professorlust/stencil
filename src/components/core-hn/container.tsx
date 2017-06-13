import { Component, h, State, Prop, Ionic } from '../index';


@Component({
  tag: 'news-container',
  styleUrls: 'main.scss'
})
export class NewsContainer {

  @State() stories: any[] = [];
  apiRootUrl: string = 'https://node-hnapi.herokuapp.com';
  page: number = 1;
  pageType: string;
  @State() firstSelectedClass: boolean;
  @State() secondSelectedClass: boolean = false;
  @State() thirdSelectedClass: boolean = false;
  @State() fourthSelectedClass: boolean = false;
  prevClass: any;

  ionViewWillLoad() {
    if (Ionic.isServer) return;

    this.firstSelectedClass = true;

    fetch(`${this.apiRootUrl}/news?page=${this.page}`).then((response) => {
      return response.json();
    }).then((data) => {
      console.log(data);
      this.stories = data;

      this.pageType = 'news';
    });
  }

  getStories(type: string) {
    if (Ionic.isServer) return;

    // reset page number
    this.page = 1;

    // this is definitely not the best solution
    // working on something more elegant, but this
    // gets the job done for the moment
    switch (type) {
      case 'news':
        this.firstSelectedClass = true;
        this.secondSelectedClass = false;
        this.thirdSelectedClass = false;
        this.fourthSelectedClass = false;
        break;
      case 'show':
        this.secondSelectedClass = true;
        this.firstSelectedClass = false;
        this.thirdSelectedClass = false;
        this.fourthSelectedClass = false;
        break;
      case 'jobs':
        this.thirdSelectedClass = true;
        this.firstSelectedClass = false;
        this.fourthSelectedClass = false;
        this.secondSelectedClass = false;
        break;
      case 'ask':
        this.fourthSelectedClass = true;
        this.thirdSelectedClass = false;
        this.secondSelectedClass = false;
        this.firstSelectedClass = false;
        break;
    }

    Ionic.controller('loading', { content: `fetching ${type} articles...` }).then((loading: any) => {
      loading.present().then(() => {
        fetch(`${this.apiRootUrl}/${type}?page=1`).then((response) => {
          return response.json();
        }).then((data) => {
          this.stories = data;

          loading.dismiss();
        });

        this.pageType = type;

      });
    });
  }

  previous() {
    if (this.page > 1) {

      Ionic.controller('loading', { content: `fetching articles...` }).then(loading => {
        loading.present().then(() => {

          this.page = this.page--;
          console.log(this.page--);

          fetch(`${this.apiRootUrl}/${this.pageType}?page=${this.page}`).then(response => {
            return response.json();
          }).then((data) => {
            console.log(data);
            this.stories = data;

            loading.dismiss();
          });

        });
      });
    } else {
      window.navigator.vibrate(200);
    }
  }

  next() {
    Ionic.controller('loading', { content: `fetching articles...` }).then(loading => {
      loading.present().then(() => {

        this.page = this.page++;
        console.log(this.page++);

        fetch(`${this.apiRootUrl}/${this.pageType}?page=${this.page}`).then(response => {
          return response.json();
        }).then(data => {
          if (data.length !== 0) {
            this.stories = data;
          }
          loading.dismiss();
        });

      });
    });
  }

  ionViewWillUpdate() {
    this.prevClass = this.page === 1 ? { 'no-back': true } : { 'yes-back': true };
  }

  render() {
    console.log('rendering');

    return [
      <ion-header mdHeight='56px' iosHeight='61px'>
        <ion-toolbar color='primary'>
          <ion-icon class='header-icon' name='ionic' slot='start'></ion-icon>

          <div class='tabs-bar'>
            <ion-button
              class={{
                'header-button': true,
                'first-button': true,
                'header-button-selected': this.firstSelectedClass
              }}
              clear
              onClick={() => this.getStories('news')}
            >
              News
          </ion-button>
            <ion-button
              class={{
                'header-button': true,
                'header-button-selected': this.secondSelectedClass
              }}
              clear
              onClick={() => this.getStories('show')}
            >
              Show
          </ion-button>
            <ion-button
              class={{
                'header-button': true,
                'header-button-selected': this.thirdSelectedClass
              }}
              clear
              onClick={() => this.getStories('jobs')}
            >
              Jobs
          </ion-button>
            <ion-button
              class={{
                'header-button': true,
                'header-button-selected': this.fourthSelectedClass
              }}
              clear
              onClick={() => this.getStories('ask')}
            >
              Ask
          </ion-button>
          </div>
        </ion-toolbar>
      </ion-header>,
      <ion-content>
        <news-list type={this.stories}>
        </news-list>
      </ion-content>,
      <ion-footer>
        <ion-toolbar class='pager'>
          <ion-buttons slot='start'>
            <ion-button class={this.prevClass} clear={true} onClick={() => this.previous()}>
              prev
          </ion-button>
          </ion-buttons>
          <span class='page-number'>
            page {this.page}
          </span>
          <ion-buttons slot='end'>
            <ion-button color='primary' clear={true} onClick={() => this.next()}>
              next
          </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>
    ];
  }
}
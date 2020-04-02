import { Component, OnInit } from '@angular/core';
import { BaseComponent } from '../base/base.component';
import { Router } from '@angular/router';
import { AlertService } from '../../services/alert/alert.service';
import { environment } from '../../../environments/environmentkeys';
import { AppSessionService } from '../../services/appsession/appSession.service';
import { ColorChangeCommunicationService } from '../../services/colorChangeCommunication/colorchangecommunication.service';
import { BVCommonService, RichiesteService, BVAuthorizationService, Utente } from 'bvino-lib';
import { CognitoUserSession } from 'amazon-cognito-identity-js';
import { CodeDeliveryDetailsType } from 'aws-sdk/clients/cognitoidentityserviceprovider';
import { LoaderService } from 'src/app/services/loader/loader.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class AuthComponent extends BaseComponent implements OnInit {

  registerColor = '#462B35';

  firstColor = '#e51d70';
  secondColor = '#f9da2c';

  constructor(
    public router: Router,
    public alertService: AlertService,
    public appSessionService: AppSessionService,
    public commonService: BVCommonService,
    public richiesteService: RichiesteService,
    public authService: BVAuthorizationService,
    public colorChangeComm: ColorChangeCommunicationService,
    public loaderService: LoaderService
  ) {
    super(router, alertService);
  }

  ngOnInit() { }

  public loginAfterSignup(username: string, password: string, name: string) {
    this.loaderService.presentLoader('autenticazione in corso');
    this.authService.signin(username, password).subscribe(
      (response: CognitoUserSession) => {
        const accessToken = response.getAccessToken();
        const idToken = response.getIdToken();
        const idUtenteDb = idToken.payload['cognito:username'];

        this.appSessionService.set(environment.KEY_USER_ID, idUtenteDb);

        // per l'interceptor per le richieste da adesso in avanti
        this.appSessionService.set(environment.KEY_AUTH_TOKEN, idToken.getJwtToken());
        this.appSessionService.set(environment.KEY_USER, JSON.stringify(response));

        // devo salvare un nuovo utente prima di procedere
        const utente = new Utente();

        utente.usernameUtente = name;
        utente.idUtente = idUtenteDb;
        utente.emailUtente = username;
        utente.idProfiloAziendaUtente = environment.ID_PROFILO_AZIENDA;

        this.commonService.put(this.richiesteService.getRichiestaPutuserProfileWithImage(utente)).subscribe(r => {
          if (r.esito.codice === environment.ESITO_OK_CODICE) {
            // salvataggio utente avvenuto con successo, procedo con il resto del login 
            this.commonService.get(this.richiesteService.getRichiestaGetUtente(idUtenteDb)).subscribe(r => {
              if (r.esito.codice === environment.ESITO_OK_CODICE) {
                const utenteDb = r.utente as Utente;

                this.appSessionService.set(environment.KEY_UTENTE, JSON.stringify(utenteDb));
                if (utente.idProfiloAziendaUtente !== undefined && utente.idProfiloAziendaUtente !== '') {
                  this.commonService.get(this.richiesteService.getRichiestaGetProfiloAzienda(utenteDb.idProfiloAziendaUtente))
                    .subscribe(s => {
                      if (s.esito.codice === environment.ESITO_OK_CODICE) {
                        const profiloAzienda = s.profiloAzienda;

                        this.appSessionService.set(environment.KEY_AZIENDA_ID, profiloAzienda.idAzienda);
                        this.appSessionService.set(environment.KEY_AZIENDA_NOME, profiloAzienda.nomeAzienda);
                        this.appSessionService.set(environment.KEY_AZIENDA_LOGO, profiloAzienda.logo);
                        this.appSessionService.set(environment.KEY_AZIENDA_SPLASHSCREEN, profiloAzienda.splaqshScreen);
                        this.appSessionService.set(environment.KEY_AZIENDA_PAYPAL_CODE, profiloAzienda.paypalCode);

                        if (profiloAzienda.colorePrimario && profiloAzienda.colorePrimario !== ''
                          && profiloAzienda.coloreSecondario && profiloAzienda.coloreSecondario !== '') {
                          this.appSessionService.set(environment.KEY_AZIENDA_COLOREPRIMARIO, profiloAzienda.colorePrimario);
                          this.appSessionService.set(environment.KEY_AZIENDA_COLORESECONDARIO, profiloAzienda.coloreSecondario);

                          this.colorChangeComm.comunicateColorChange();
                        }
                        this.loaderService.dismissLoader();
                        this.router.navigate(['/eventi']);

                      } else {
                        this.loaderService.dismissLoader();
                        this.alertService.presentErrorAlert(s.esito.message);
                      }
                    }, err2 => {
                      this.loaderService.dismissLoader();
                      this.alertService.presentErrorAlert(err2.statusText);
                    });
                } else {
                  // profilo generico
                }

                // ora devo recuperare il profiloAzienda

              } else {
                this.loaderService.dismissLoader();
                this.alertService.presentErrorAlert(r.esito.message);
              }
            }, err => {
              this.loaderService.dismissLoader();
              this.alertService.presentErrorAlert(err.statusText);
            });
          } else {
            this.loaderService.dismissLoader();
            this.alertService.presentErrorAlert(r.esito.message);
          }
        });
      }
    );
  }

  public login(username: string, password: string) {
    this.loaderService.presentLoader('autenticazione in corso');
    this.authService.signin(username, password).subscribe(

      (response: CognitoUserSession) => {
        const accessToken = response.getAccessToken();
        const idToken = response.getIdToken();
        const idUtenteDb = idToken.payload['cognito:username'];

        this.appSessionService.set(environment.KEY_USER_ID, idUtenteDb);

        // per l'interceptor per le richieste da adesso in avanti
        this.appSessionService.set(environment.KEY_AUTH_TOKEN, idToken.getJwtToken());
        this.appSessionService.set(environment.KEY_USER, JSON.stringify(response));

        if (idUtenteDb === undefined || idUtenteDb === '') {
          this.alertService.presentErrorAlert('Utente loggato ma manca il corrispondente sul DB. Non posso procedere');
          this.loaderService.dismissLoader();
          this.router.navigate(['/login']);
        } else {
          this.commonService.get(this.richiesteService.getRichiestaGetUtente(idUtenteDb)).subscribe(r => {
            if (r.esito.codice === environment.ESITO_OK_CODICE) {
              const utente = r.utente as Utente;
              this.appSessionService.set(environment.KEY_UTENTE, JSON.stringify(utente));
              if (utente.idProfiloAziendaUtente !== undefined && utente.idProfiloAziendaUtente !== '') {
                this.commonService.get(this.richiesteService.getRichiestaGetProfiloAzienda(utente.idProfiloAziendaUtente)).subscribe(s => {
                  if (s.esito.codice === environment.ESITO_OK_CODICE) {
                    const profiloAzienda = s.profiloAzienda;

                    this.appSessionService.set(environment.KEY_AZIENDA_ID, profiloAzienda.idAzienda);
                    this.appSessionService.set(environment.KEY_AZIENDA_NOME, profiloAzienda.nomeAzienda);
                    this.appSessionService.set(environment.KEY_AZIENDA_LOGO, profiloAzienda.logo);
                    this.appSessionService.set(environment.KEY_AZIENDA_SPLASHSCREEN, profiloAzienda.splaqshScreen);
                    this.appSessionService.set(environment.KEY_AZIENDA_PAYPAL_CODE, profiloAzienda.paypalCode);

                    if (profiloAzienda.colorePrimario && profiloAzienda.colorePrimario !== ''
                      && profiloAzienda.coloreSecondario && profiloAzienda.coloreSecondario !== '') {
                      this.appSessionService.set(environment.KEY_AZIENDA_COLOREPRIMARIO, profiloAzienda.colorePrimario);
                      this.appSessionService.set(environment.KEY_AZIENDA_COLORESECONDARIO, profiloAzienda.coloreSecondario);

                      this.colorChangeComm.comunicateColorChange();
                    }
                    this.loaderService.dismissLoader();
                    this.router.navigate(['/eventi']);

                  } else {
                    this.loaderService.dismissLoader();
                    this.alertService.presentErrorAlert(s.esito.message);
                  }
                }, err2 => {
                  this.loaderService.dismissLoader();
                  this.alertService.presentErrorAlert(err2.statusText);
                });
              } else {
                // profilo generico
              }

              // ora devo recuperare il profiloAzienda

            } else {
              this.loaderService.dismissLoader();
              this.alertService.presentErrorAlert(r.esito.message);
            }
          }, err => {
            this.loaderService.dismissLoader();
            this.alertService.presentErrorAlert(err.statusText);
          });
        }
      },
      (err) => {
        this.loaderService.dismissLoader();
        this.alertService.presentErrorAlert('Errore di autenticazione');
        console.log('ERRORE DI AUTENTICAZIONE: ' + err);
      });
  }
}

\# Qubiz — Design System

\### Enterprise AI Engineering · qubiz.com



Acest document descrie sistemul vizual al site-ului Qubiz, pe baza analizei paginii de start (hero + secțiune de carduri) și a secțiunilor suplimentare: capabilități, statistici, case studies, industrii, footer și mega-meniul de navigare.



\---



\## 1. Identitate de brand



Qubiz se poziționează ca partener de inginerie enterprise pe termen lung, nu ca furnizor punctual. Tonul vizual reflectă acest lucru: serios, corporate, dar cu un accent tehnologic discret (geometrie, gradient subtil în logo) care sugerează AI/date fără a cădea în clișeele futuriste (neon, glow excesiv).



\*\*Logo\*\*: simbol geometric format din pătrate/triunghiuri colorate (cyan → portocaliu, gradient diagonal), urmat de wordmark „Qubiz" în cyan, font sans-serif bold.



\---



\## 2. Paletă de culori



| Rol | Culoare | Hex aproximativ |

|---|---|---|

| Primary / Navy (text principal, butoane, carduri) | Bleumarin închis, aproape negru | `#0B2A3D` – `#102C3E` |

| Background principal | Off-white / gri foarte deschis, cald | `#F1F0EC` |

| Background carduri secundare | Aceeași tonalitate navy, ușor desaturată | `#13313F` |

| Accent 1 — Cyan/Teal (logo, link-uri active) | Turcoaz | `#2BC4D9` |

| Accent 2 — Portocaliu (logo, highlight) | Portocaliu cald | `#F2994A` |

| Text secundar / subtitluri | Gri-albastru | `#5C6B73` |

| Text pe fundal navy | Alb | `#FFFFFF` |

| Text muted pe fundal navy (etichete „SERVICE", „EVENT", „COMPANY", „CAPABILITIES") | Gri deschis, uppercase | `#9CA9AF` |

| Background secțiuni intermediare (ex. „Four Capabilities") | Albastru-gri foarte deschis, mai rece decât hero-ul | `#E9F1F3` |

| Footer | Navy aproape negru, cea mai închisă notă din paletă | `#0B1E2B` |

| Imagine/textură decorativă (panou capabilități) | Gradient/noise în familia teal, dungi verticale | `#3C8FA0` – `#A9D2D8` |

| Linii separatoare / borduri subtile | Gri foarte deschis | `#E2E5E4` |



Contrastul e construit pe alternanța \*\*off-white ↔ navy\*\*, repetată consecvent pe toată pagina (nu doar în hero): secțiuni deschise (text, conținut explicativ) alternează cu benzi închise (statistici, footer, carduri de proof), creând ritm vertical clar la scroll. Footer-ul e cea mai închisă notă, semnalând „capătul" paginii.



\---



\## 3. Tipografie



\- \*\*Familie\*\*: sans-serif geometric/modern (stil Inter, Söhne sau similar) — bară uniformă, fără serife, terminale rotunjite ușor.

\- \*\*Titlu hero (H1)\*\*: foarte bold, dimensiune mare (\~52–60px), line-height strâns, culoare navy. Conține un cursor text-animat (efect de typing) — semnal de interactivitate/AI.

\- \*\*Subtitlu hero\*\*: regular, \~18px, culoare gri-albastru, lățime limitată (\~520px) și centrat, line-height generos pentru lizibilitate.

\- \*\*Titluri carduri\*\* (ex. „Enterprise-Grade AI Engineering"): bold, alb, \~28–32px, line-height compact.

\- \*\*Eticete kicker\*\* („SERVICE", „EVENT"): uppercase, mic (\~12px), letter-spacing mărit, gri deschis — folosite ca taxonomie vizuală deasupra titlurilor de card.

\- \*\*Navigație\*\*: regular/medium, \~15px, navy, cu chevron mic pentru dropdown-uri.

\- \*\*Titlu de secțiune (H2)\*\*, ex. „Four Capabilities. One Engineering Approach” / „Domain depth.”: bold, navy, \~36–44px, adesea pe 2 linii, precedat de un kicker uppercase mic, gri, centrat sau aliniat stânga în funcție de secțiune.

\- \*\*Cifre statistice\*\* (ex. „350+”, „€2.4B”, „58%”, „15 yrs”): extra-bold, alb, foarte mari (\~40–48px), font tabular/monospace-like pentru aliniere; eticheta descriptivă dedesubt e mică, regular, gri deschis.

\- \*\*Liste de navigare laterală\*\* (industrii, meniu mega-dropdown): regular \~16px, gri mediu pentru itemii inactivi, navy/bold pentru itemul activ — fără fundal colorat, doar contrast de culoare text.

\- \*\*Linkuri footer\*\*: regular, \~14px, gri-albastru deschis pe fundal navy-închis, fără underline implicit.



\---



\## 4. Layout \& grid



\- \*\*Container\*\*: conținutul e centrat, cu margini generoase laterale (whitespace amplu pe desktop), max-width \~1600px.

\- \*\*Header\*\*: bandă albă, full-width, fixată în interiorul unui „frame" cu colțuri rotunjite (întreaga pagină pare încadrată într-un border subțire/dark — efect de „canvas" browser-like).

\- \*\*Hero\*\*: centrat pe orizontală, stivă verticală simplă: titlu → subtitlu → 2 butoane CTA, totul aliniat pe centru, mult spațiu gol deasupra/dedesubt.

\- \*\*Secțiunea de carduri\*\*: grid orizontal pe 3 coloane inegale (sidebar imagine — card text — card media mare — card text), fără gutter vizibil, cardurile sunt „edge-to-edge", lipite unul de altul, creând o bandă continuă full-bleed.

\- \*\*Card media central\*\*: ocupă cea mai mare parte din lățime, conține imagine/video de tip „talking head" (persoană vorbind în plan apropiat) cu overlay minimal.

\- \*\*Secțiune capabilități (numerotată)\*\*: split 50/50 — stânga text (kicker numeric „01”, titlu, paragraf, CTA „Explore”), dreapta panou vizual full-bleed cu textură/gradient teal abstract (nu fotografie). Fundal de secțiune diferit de hero (albastru-gri rece).

\- \*\*Bandă de statistici\*\*: full-width, fundal navy, 4 coloane egale separate prin linii verticale subtile, fiecare coloană = cifră mare + etichetă mică dedesubt, totul centrat.

\- \*\*Secțiune case studies\*\*: header cu kicker + titlu pe stânga și sub-text aliniat dreapta (split asimetric), urmat de un tab-bar orizontal (nume companii, tab activ subliniat cu accent cyan) și un carusel de carduri cu preview parțial al cardurilor adiacente (efect „peek”/overflow pe margini, semnalând scroll orizontal).

\- \*\*Secțiune industrii\*\*: split stânga/dreapta — stânga listă verticală simplă de industrii (text-only, fără iconuri, separate prin linii subțiri, itemul activ bold/negru restul gri), dreapta panou mare cu imagine + kicker + titlu + paragraf + CTA săgeată.

\- \*\*Footer\*\*: fundal navy foarte închis, full-width, layout pe coloane (logo+social stânga, apoi 4 coloane de linkuri: Company / Capabilities / Industries / Find Us), linie separatoare subțire deasupra rândului legal (copyright + linkuri legale mici).

\- \*\*Mega-meniu dropdown\*\* (navigare): la deschidere, header-ul se extinde într-un panou alb sub bară, organizat pe 2 coloane — coloana principală cu breadcrumb mic + listă de capabilități (titlu bold + descriere scurtă gri sub fiecare), coloana secundară doar cu listă simplă de industrii (titlu kicker + linkuri). Itemul de meniu activ din navbar își schimbă culoarea în gri/dezactivat vizual cât timp dropdown-ul e deschis.



\---



\## 5. Componente



\### 5.1 Header / Navbar

\- Fundal alb, colțuri rotunjite (radius mare, \~16-20px) pe toată banda.

\- Logo în stânga.

\- Meniu central: 3 itemi cu dropdown (`The foundation`, `The practice`, `The proof`) — chevron-uri mici jos.

\- CTA dreapta: buton pill navy „Your brief” cu icon săgeată în cerc alb.



\### 5.2 Butoane

Două variante consistente în tot site-ul:

1\. \*\*Primary (filled)\*\*: fundal navy, text alb, formă „pill” (radius complet), cu un cerc alb la capătul din dreapta conținând o săgeată navy.

2\. \*\*Secondary (outline/light)\*\*: fundal alb/transparent, text navy, aceeași formă pill, cerc navy cu săgeată albă la capăt.



Pattern-ul „text + cerc cu săgeată” e un element de semnătură vizuală, repetat consecvent.



\### 5.3 Carduri de conținut (dark cards)

\- Fundal navy plin, text alb.

\- Kicker uppercase mic în partea de sus.

\- Titlu bold mare în partea de jos a cardului (conținut „ancorat” spre bază, whitespace mare deasupra).

\- Fără borduri sau umbre — separarea se face strict prin culoare/contrast.



\### 5.4 Imagini

\- Fotografii reale, lifestyle/corporate (echipă la birou, persoană vorbind în cameră, mâini pe tastatură) — nu ilustrații sau iconografie abstractă, \*\*cu excepția\*\* panourilor decorative din secțiunea de capabilități, unde se folosesc texturi/gradient-uri abstracte (dungi verticale teal cu noise) ca substitut pentru fotografie — semnal vizual pentru concepte mai tehnice/abstracte (strategie, arhitectură).

\- Ton cald, lumină naturală, profunzime de câmp redusă (blur de fundal) pentru imaginea „talking head” și pentru fotografiile de tip „context industrie” (ex. stetoscop + laptop pentru healthcare).

\- Imaginile sunt tratate ca blocuri full-bleed în interiorul cardurilor, fără padding intern; colțuri ușor rotunjite în cardurile de case study.



\### 5.5 Bandă de statistici (stats bar)

\- Fundal navy plin, full-width, fără imagini — doar tipografie.

\- 4 metrici cheie afișate ca grid orizontal egal, separate prin linii verticale fine (nu carduri/borduri).

\- Funcție: validare socială/credibilitate ("social proof in numbers"), poziționată ca tranziție între hero/intro și conținutul detaliat.



\### 5.6 Carduri numerotate (capabilități)

\- Layout text+vizual 50/50, repetat pentru fiecare din cele 4 capabilități, alternând probabil orientarea (text stânga/dreapta) de la o secțiune la alta.

\- Eticheta numerică („01”, „02”...) mică, gri, deasupra titlului — substituie kicker-ul uppercase folosit în alte secțiuni, dă senzație de progresie/parcurs.

\- CTA local „Explore” — buton mic, aceeași familie vizuală (pill navy + cerc cu săgeată), dar dimensiune redusă față de CTA-urile din hero.



\### 5.7 Tabs + carusel (case studies)

\- Tab-bar orizontal simplu (text, fără fundal pe tab), tab-ul activ marcat printr-o linie subțire colorată (accent cyan) dedesubt — pattern de „underline tab”, consistent cu restul site-ului (fără fundaluri colorate inutile).

\- Cardurile de case study conțin: kicker (numele clientului) + badge mic rotunjit (categorie, ex. „AI Engineering”) + titlu bold + paragraf scurt + link cu săgeată „VIEW CASE STUDY”.

\- Carusel cu „peek”: cardurile adiacente sunt parțial vizibile la margini, indicând afordanță de scroll orizontal fără a avea nevoie de săgeți vizibile permanent.



\### 5.8 Listă industrii (sidebar + detail)

\- Pattern „master-detail”: listă simplă de text în stânga (fără iconuri), selecția schimbă conținutul din dreapta (imagine + descriere).

\- Diferențiere activ/inactiv doar prin greutate și culoare font (bold+navy vs. regular+gri) — fără chip-uri sau fundaluri.



\### 5.9 Footer

\- Fundal cel mai închis din paletă (aproape negru-navy), organizat clasic pe coloane: brand+social → Company → Capabilities → Industries → Find Us (locații birouri + email contact).

\- Iconuri social (LinkedIn, Instagram) minimaliste, outline, fără culoare — se aliniază la restul interfeței monocrome.

\- Rând legal jos, separat printr-o linie subțire: copyright + linkuri legale (Terms, Privacy, Cookie Policy) — text foarte mic, gri.



\### 5.10 Mega-meniu (navigare)

\- Dropdown full-width sub navbar, fundal alb, fără umbră puternică — separare prin linie fină.

\- Structură pe 2 coloane inegale: coloana principală listează capabilitățile ca „titlu + descriere de o linie” (mai descriptiv decât un meniu clasic), coloana secundară e o listă simplă de industrii (doar titluri).

\- Breadcrumb mic („/ capabilities”) în colțul stânga-sus al panoului — semnal de orientare/locație curentă.



\---



\## 6. Spațiere \& ritm



\- Whitespace generos în hero (zonă de „respiro” deasupra titlului și sub butoane) — același principiu se aplică în secțiunea de capabilități (text vertical centrat în jumătatea de card).

\- Tranziție bruscă de la secțiunea deschisă (hero) la banda închisă (carduri/stats/footer) — fără gradient de tranziție, graniță netă; acest pattern „light → dark → light → dark (footer)” se repetă consecvent pe toată pagina, nu doar la hero.

\- Padding intern carduri: generos lateral, conținutul text aliniat în partea inferioară a cardului (vertical bottom-align) în cardurile de tip „proof”, dar centrat vertical în secțiunile de capabilități numerotate.

\- Separatorii subtili (linii fine, 1px, gri foarte deschis) sunt preferați în locul cardurilor cu umbră — vizibil în lista de industrii, în tab-bar și în stats bar.



\---



\## 7. Ton \& personalitate vizuală



\- \*\*Corporate, dar nu rigid\*\* — geometria logo-ului și cursorul animat din hero introduc o notă tech/dinamică.

\- \*\*Încredere și seriozitate\*\* — paleta navy + off-white evocă fiabilitate enterprise (similar cu fintech/consultanță), nu un startup AI „flashy”.

\- \*\*Claritate înainte de decor\*\* — fără gradient-uri grele, fără particule/efecte 3D; accentul cade pe tipografie și fotografie reală.



\---



\## 8. Recomandări pentru extindere (consistență)



\- Păstrează contrastul navy/off-white ca pattern recurent între secțiuni (alternanță light → dark → light → dark), inclusiv pentru footer ca "punct final" cel mai închis.

\- Reutilizează pattern-ul de buton „text + cerc cu săgeată” pentru orice CTA nou, în ambele dimensiuni (mare în hero, mic în carduri de capabilități/case study).

\- Kicker-urile uppercase (SERVICE, EVENT, CASE STUDIES, INDUSTRIES WE SERVE) pot deveni un sistem de taxonomie reutilizabil pentru orice tip de conținut.

\- Evită adăugarea de culori noi în afara paletei cyan/portocaliu — acestea rămân rezervate logo-ului/accentelor minore (ex. underline-ul tab-ului activ), nu pentru UI generalizat.

\- Pattern-ul „master-detail” (listă text + panou de conținut, vizibil în secțiunea de industrii) e reutilizabil pentru orice conținut comparativ/filtrabil viitor.

\- Preferă separatori subțiri (1px) și contrast de greutate font în locul fundalurilor colorate sau umbrelor pentru a indica stare activă/inactivă — e un principiu transversal pe tot site-ul (tabs, liste, navigare).


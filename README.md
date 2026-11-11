# 운림사 · 산사 탐방

첨부된 `unrimsa-android.apk`에서 복원한 Android 프로젝트입니다. 패키지 이름은 `com.unrimsa.explore`이며 버전은 3.0(버전 코드 3)입니다.

| 위치 | 내용 |
| --- | --- |
| `app/src/main/assets/` | APK에서 그대로 추출한 HTML·JavaScript, Three.js, 3D 모델, 텍스처, 음원 |
| `app/src/main/java/com/unrimsa/explore/TempleActivity.java` | DEX의 동작을 대조해 재작성한 Android 액티비티 및 WebView 리소스 로더 |
| `app/src/main/AndroidManifest.xml` | 바이너리 매니페스트에서 복원한 앱 선언 |
| `app/src/main/res/drawable/temple.xml` | APK의 벡터 아이콘을 읽을 수 있는 XML로 복원한 파일 |
| `reference/` | 대조용 원본 DEX와 명령어 덤프 |

게임 진입점은 `assets/index.html`과 `assets/game.js`입니다. `world.js`는 사찰과 지형을, `nature.js`는 수면과 숲을, `walk.js`는 이동을 담당합니다.

## Android 빌드

압축을 푼 뒤 `settings.gradle`이 있는 폴더를 Android Studio에서 엽니다. Android SDK 35와 JDK 17을 준비하고 Gradle 8.9로 동기화합니다. 명령줄에서 빌드하려면 설치된 Gradle 8.9로 아래 명령을 실행합니다.

```sh
gradle :app:assembleDebug
```

빌드 결과 경로는 `app/build/outputs/apk/debug/app-debug.apk`입니다. 원본 APK가 설치된 기기에 덮어 설치하려면 원본 서명과 일치하는 키가 필요합니다.

[Android Gradle Plugin 8.7 호환성 표](https://developer.android.com/build/releases/agp-8-7-0-release-notes)

## 브라우저에서 열기

프로젝트 루트에서 웹 리소스 폴더를 HTTP 서버의 루트로 지정합니다.

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory app/src/main/assets
```

WebGL을 사용할 수 있는 브라우저에서 [http://127.0.0.1:8000/](http://127.0.0.1:8000/)을 엽니다.

## 복원 및 검증 범위

- APK에 들어 있는 `assets/` 파일 26개를 바이트 단위로 대조했습니다. JavaScript 문법과 XML 파싱도 검사했습니다.
- Android용 Java 소스의 변수명과 소스 구성은 복원 과정에서 정했습니다. Gradle 설정은 APK의 SDK·버전 정보를 바탕으로 새로 작성했습니다. 원본 프로젝트의 주석, 개발 중간 파일과 서명 개인 키는 APK에서 복원할 수 없습니다.
- Android 빌드와 기기 실행은 검증하지 못했습니다.

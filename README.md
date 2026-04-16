# WhereYouAt

이 폴더에는 웹과 iOS에서 사진 업로드 후 EXIF 위치 정보를 이용해 지도를 표시하는 샘플 코드가 포함되어 있습니다.

## 웹
- `web/index.html`
- `web/style.css`
- `web/app.js`

웹 브라우저에서 `web/index.html`을 열고 사진을 업로드하면 지도에 위치 기반 썸네일 마커가 표시됩니다.

## iOS
- `ios/WhereYouAtApp.swift`
- `ios/ContentView.swift`

이 코드는 SwiftUI 기반 샘플입니다. Xcode에서 새 SwiftUI 앱 프로젝트를 만들고 해당 파일들을 교체하여 테스트하세요.

### iOS Info.plist 설정
- `NSPhotoLibraryUsageDescription`에 사진 라이브러리 접근 이유를 추가하세요.

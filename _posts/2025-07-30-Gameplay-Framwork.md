---
title: Gameplay Framwork
description: Unreal의 Gameplay Framework
author: gemini
date: 2025-07-30 16:00:00 +09:00
categories: [Unreal]
tags: [Framework]
math: true
mermaid: true
---

#### Framwork 4대 클래스

>GameMode -> 게임의 심판관 (규칙, 흐름 제어, 승부 판정)<br>
>GameState -> 게임 상황판 (모든 플레이어가 보는 공통 정보)<br>
>PlayerState -> 개인 수첩 (각 플레이어만의 정보)<br>
>GameInstance -> 게임 관리자 (전체 생명주기, 레벨 간 데이터)<br>
{: .prompt-info}

- 단일 책임 원칙
    - GameMode : 오직 "결정"만
    - GameState : 오직 "정보 저장"만
    - PlayerState : 오직 "개인 데이터"만
    - GameInstance : 오직 "전체 관리"만


#### GameMode

>**Base VS 일반 차이점**<br>
>GameModeBase : 기본 기능만 (가벼움)<br>
>    - 단순한 게임 시작/종료<br>
>    - 기본 생명주기만<br>
><br>
>GameMode ; 완전한 매치 시스템 (무거움)<br>
>    -  EMatchState 매치 상태 관리<br>
>    - 자동 리스폰 시스템<br>
>    - 관전자 모드 지원<br>
{: .prompt-tip}

>**조합 규칙(중요!)**<br>
> ✅GameModeBase <-> GameStateBase<br>
>✅GameMode <-> GameState<br>
>❌GameModeBase <-> GameState (컴파일 에러)<br>
>❌GameMode <-> GameStateBase (기능 누락)<br>
{: .prompt-warning}

- 기본 구조

```
class AMyGameMode : public AGameModeBase
{
public:
    // 게임 규칙 (개발자만 설정, 런타임 변경 불가)
    UPROPERTY(EditDefaultsOnly, Category = "Rules")
    float MatchDuration = 300.0f;

    UPROPERTY(EditDefaultsOnly, Category = "Rules")
    int32 ScoreToWin = 1000;

    // 게임 흐름 제어
    UFUNCTION(BlueprintCallable)
    void StartMatch();

    UFUNCTION(BlueprintCallable)
    void EndMatch(bool bPlayerWon);

private:
    bool bMatchInProgress = false;
    FTimerHandle MatchTimer;
};
```

- 핵심 구현 패턴

```
// GameMode의 가장 중요한 패턴
void AMyGameMode::StartMatch()
{
    // 1. GameMode는 "결정"을 내리고
    bMatchInProgress = true;

    // 2. GameState에게 "정보 업데이트"를 위임
    if (AMyGameState* GS = GetGameState<AMyGameState>())
    {
        GS->NotifyMatchStarted(MatchDuration);
    }

    // 3. 게임 종료 타이머 설정
    GetWorldTimerManager().SetTimer(MatchTimer, [this]() {
        EndMatch(false); // 시간 초과
    }, MatchDuration, false);
}
```


#### GameState

- 핵심 철학
    - 정보 제공자 : 은행 전광판처럼 정보만 표시
    - 읽기 전용 : UI에서 참조만, 직접 수정 불가
    - GameMode 전용 업데이트 : 다른 곳에서 함부로 수정하면 안됨

- GameState의 올바른 사용법
    1. GameMode가 상태를 계산해서 GameState에 알려줌
    2. GameState는 그 상태를 전 클라이언트에 자동으로 복제
    3. UI나 애니메이션은 GameState를 보고 표시만 함

- 기본 구조

```
class AMyGameState : public AGameStateBase
{
public:
    // 읽기 전용 정보
    UPROPERTY(BlueprintReadOnly, Replicated)
    float RemainingTime = 0.0f;

    // GameMode 전용 업데이트 (다른 곳에서 호출 금지!)
    UFUNCTION(BlueprintCallable)
    void NotifyMatchStarted(float Duration);

    // UI 친화적 데이터 가공
    UFUNCTION(BlueprintPure)
    FString GetFormattedTime() const;
};

```

- 핵심 구현 패턴

```
// UI 친화적 시간 포맷팅
FString AMyGameState::GetFormattedTime() const
{
    int32 Minutes = RemainingTime / 60;
    int32 Seconds = (int32)RemainingTime % 60;
    return FString::Printf(TEXT("%02d:%02d"), Minutes, Seconds);
}

// 시간에 따른 색상 변화 (UI 활용)
FLinearColor AMyGameState::GetTimeColor() const
{
    float Ratio = RemainingTime / InitialDuration;
    if (Ratio > 0.5f) return FLinearColor::Green;   // 여유
    if (Ratio > 0.2f) return FLinearColor::Yellow;  // 주의
    return FLinearColor::Red;                       // 위험
}
```


#### PlayerState

>생명주기 특징<br>
>레벨 전환 시:<br>
>GameMode     [파괴] -> [새로 생성]<br>
>GameState      [파괴] -> [새로 생성]<br>
>PlayerState      [유지] -> [유지]        <- 특별함!<br>
{: .prompt-info}

>소유권 구조<br>
>GameMode (권한자) -> PlayerController (소유자) -> PlayerState (실제 데이터)<br>
{: .prompt-info}

- 올바른 접근 방법

```
잘못된 접근
    - ❌ AMyPlayerState* PS = GetWorld()->GetGameState()->PlayerArrya[0];
올바른 접근
    - ✅ AMyPlayerState* PS = GetPlayerState<AMyPlayerState>();

GameMode (서버)
    - PlayerController (각 플레이어마다 존재, 서버/클라 둘 다)
    - PlayerState (각각 모든 유저의 정보, 서버와 클라 모두 존재)
```

- 기본 구조

```
class AMyPlayerState : public APlayerState
{
public:
    // 개인 소유 데이터
    UPROPERTY(BlueprintReadOnly, Replicated)
    int32 CurrentScore = 0;

    UPROPERTY(BlueprintReadOnly, Replicated)
    int32 Lives = 3;

    // 안전한 데이터 변경
    UFUNCTION(BlueprintCallable)
    void AddScore(int32 Points);

    // 상태 조회
    UFUNCTION(BlueprintPure)
    bool IsGameOver() const { return Lives <= 0; }

    // 이벤트 시스템
    DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnScoreChanged, int32, Old, int32, New);
    UPROPERTY(BlueprintAssignable)
    FOnScoreChanged OnScoreChanged;

private:
    int32 HighScore = 0;
};

```

- 핵심 구현 패턴

```
// 데이터 무결성 보장 패턴
void AMyPlayerState::AddScore(int32 Points)
{
    if (Points <= 0) return; // 1. 유효성 검사

    int32 OldScore = CurrentScore;
    CurrentScore += Points;   // 2. 안전한 업데이트

    // 3. 최고 기록 갱신
    if (CurrentScore > HighScore)
    {
        HighScore = CurrentScore;
        UE_LOG(LogTemp, Warning, TEXT("신기록 달성! %d"), HighScore);
    }

    // 4. 이벤트 발생 (UI가 자동으로 반응)
    OnScoreChanged.Broadcast(OldScore, CurrentScore);

    // 5. GameMode에게 승리 조건 체크 요청
    if (AMyGameMode* GM = GetWorld()->GetAuthGameMode<AMyGameMode>())
    {
        GM->CheckVictoryCondition();
    }
}
```


#### GameInstance

- 절대적 특징
    - 게임 전체 생명주기 : 시작부터 종료까지 살아있음
    - 레벨 간 데이터 유지 : 레벨 바뀌어도 절대 안 사라짐
    - 레벨 전환 권한 : 오직 GameInstance만 레벨 바꿀 수 있음

- 기본 구조

```
UCLASS()
class UMyGameInstance : public UGameInstance
{
public:
    virtual void Init() override;
    
    // 영속적 데이터 (레벨 바뀌어도 절대 안 사라짐)
    UPROPERTY(BlueprintReadWrite)
    FString PlayerName = TEXT("Player");
    
    UPROPERTY(BlueprintReadWrite)
    int32 TotalScore = 0;           // 전체 누적 점수
    
    UPROPERTY(BlueprintReadWrite)
    int32 CompletedLevels = 0;
    
    // 레벨 전환 중앙 관리
    UFUNCTION(BlueprintCallable)
    void LoadGameLevel(int32 LevelIndex);
    
    UFUNCTION(BlueprintCallable)
    void LoadNextLevel();
    
    // 게임 진행 상황 통합
    UFUNCTION(BlueprintCallable)
    void ReportLevelCompleted(int32 LevelIndex, int32 Score);

private:
    int32 CurrentLevelIndex = 0;
    bool bIsChangingLevel = false;
};
```

- GameInstance의 스마트한 레벨 전환

```
// MyGameInstance.cpp - 레벨 전환의 핵심
void UMyGameInstance::LoadGameLevel(int32 LevelIndex)
{
    if (bIsChangingLevel) return; // 중복 방지
    
    UE_LOG(LogTemp, Warning, TEXT("레벨 %d 로딩 시작"), LevelIndex);
    
    bIsChangingLevel = true;
    CurrentLevelIndex = LevelIndex;
    
    // 현재 상태 백업 (중요!)
    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        if (AMyPlayerState* PS = PC->GetPlayerState<AMyPlayerState>())
        {
            TotalScore += PS->GetCurrentScore(); // 백업
        }
    }
    
    // 실제 레벨 로딩
    FString LevelName = FString::Printf(TEXT("Level_%d"), LevelIndex);
    UGameplayStatics::OpenLevel(GetWorld(), FName(*LevelName));
}

void UMyGameInstance::ReportLevelCompleted(int32 LevelIndex, int32 Score)
{
    UE_LOG(LogTemp, Warning, TEXT("레벨 %d 완료! 점수: %d"), LevelIndex, Score);
    
    TotalScore += Score;
    CompletedLevels = FMath::Max(CompletedLevels, LevelIndex);
    
    // 2초 후 다음 레벨로
    FTimerHandle Timer;
    GetWorldTimerManager().SetTimer(Timer, [this]() {
        LoadNextLevel();
    }, 2.0f, false);
}

void UMyGameInstance::LoadNextLevel()
{
    // 그냥 다음 인덱스 기반으로 호출만 위임
    LoadGameLevel(CurrentLevelIndex + 1);
}
```


#### Framework 로딩 순서 (중요!)

>게임 시작부터 레벨 로딩까지 완전한 순서<br>
>엔진 부팅 단계<br>
>1. 엔진 초기화 (UEngine 생성)<br>
>2. GameInstance::Init()     **가장 먼저!**<br>
>    - 이 시점: World 없음, GameMode 없음<br>
>    - 글로벌 설정, 서브 시스템 초기화만 가능<br>
><br>
>첫 레벨 로딩 단계<br>
>3. World 생성<br>
>4. GameMode 생성 -> PostInitializeComponent()<br>
>5. GameState 생성 -> PostInitializeComponent()<br>
>6. PlayerController 생성<br>
>7. PlayerState 생성<br>
>8. Pawn 생성<br>
>9. 모든 BeginPlay() 호출 (순서 보장 안됨)
><br>
>레벨 전환 시<br>
>10. 기존 World 파괴 (GameMode, GameState 사라짐)<br>
>11. PlayerState는 새 World로 이주<br>
>12. 3~9번 과정 반복<br>
{: .prompt-info}

- 각 단계에서 할 수 있는 것/없는 것
    - GameInstance::Init()
        - ✅할 수 있는 것
            - 글로벌 설정 로드
            - 서브 시스템 초기화
            - SaveGame 데이터 로드
        - ❌하면 안되는 것
            - GetWorld() 호출 **(아직 없음)**
            - GameMode, PlayerController 접근
            - UI 생성
    - GameMode 생성자
        - ✅할 수 있는 것
            - 기본 클래스 설정
            - 게임 규칙 변수 초기화
        - ❌하면 안되는 것
            - GameState  접근 **(아직 생성 안됨)**
            - PlayerController 접근
    - PostInitializeComponents()
        - ✅이 시점부터
            - GameState 접근 가능
            - 다른 Framework 객체들과 안전한 통신

- 생명주기 함수 안전성

```
//위험도 순서(높음 -> 낮음)
생성자          // 의존성 객체 없음
PostInitComp   // 일부 객체 준비됨
BeginPlay      // ⚠️ 순서 보장 안됨
PostLogin      // ✅ 모든 게 준비됨 (가장 안전)
StartPlay      // ✅ 완전 준비 완료
```

- 초기화 문제 해결 패턴

```
// ❌ 위험한 코드 - BeginPlay에서 PlayerState 접근
void AMyGameMode::BeginPlay()
{
    // PlayerState가 아직 없을 수 있음!
    AMyPlayerState* PS = GetFirstPlayerState(); // 크래시!
}

// ✅ 안전한 코드 - PostLogin 사용
void AMyGameMode::PostLogin(APlayerController* NewPlayer)
{
    // 이 시점에서는 PlayerState 확실히 존재
    if (AMyPlayerState* PS = NewPlayer->GetPlayerState<AMyPlayerState>())
    {
        PS->InitializePlayer(); // 안전함
    }
}

// ✅ GameState 준비 확인 방법
void AMyGameMode::SomeFunction()
{
    if (AMyGameState* GS = GetGameState<AMyGameState>())
    {
        if (GS->HasBegunPlay()) // 준비 완료 확인
        {
            GS->UpdateSomeData(); // 안전한 업데이트
        }
    }
}
```

| 타이밍                                        | ✅ 가능한 것들                   | ❌ 절대 금지할 것들                      |
| ------------------------------------------ | -------------------------- | -------------------------------- |
| `GameInstance::Init()`                     | 글로벌 설정, SaveGame, 네트워크 초기화 | `GetWorld()`, GameMode 접근 등      |
| `GameMode 생성자`                             | 클래스 설정, 룰 초기화              | GameState, PlayerController 접근   |
| `GameMode`<br>`PostInitializeComponents()` | GameState 접근               | PlayerController, PlayerState 접근 |
| `BeginPlay()`                              | 게임 로직 스타트 지점 (순서 랜덤)       | 의존성 있는 접근 (특히 PlayerState 접근)    |
| `PostLogin()`                              | ✅ 플레이어 모든 정보 완비 -> 믿고 써도 됨 | 없음                               |

- 레벨 전환 시의 특별한 메커니즘

>// 레벨 전환 시퀀스 (UGameplayStatics::OpenLevel 호출 시)<br>
><br>
>현재 레벨 정리 단계<br>
>1. 모든 액터의 EndPlay() 호출<br>
>2. GameMode, GameState 파괴<br>
>3. 일반 액터들 모두 파괴<br>
>4. PlayerState만 특별히 보존! ⭐<br>
><br>
>새 레벨 로딩 단계<br>
>5. 새 World 생성<br>
>6. PlayerState를 새 World로 이주 ⭐<br>
>7. 새 GameMode, GameState 생성<br>
>8. PlayerController와 기존 PlayerState 재연결<br>
>9. 새 Pawn 생성<br>
>10. 모든 BeginPlay() 호출<br>
{: .prompt-info}

>PlayerState는 파괴되지 않지만 "이주" 과정에서 일시적으로 접근 불가<br>
>GameInstance만 완전히 연속성 보장<br>
>레벨 전환 중간에 데이터 접근하면 크래시 위험<br>
>{: .prompt-warning}


#### 시스템 협력 흐름

- 완전한 게임 시나리오

```
// 1. 플레이어가 아이템 수집
void AMyPlayer::OnCollectItem(int32 Value)
{
    if (AMyPlayerState* PS = GetPlayerState<AMyPlayerState>())
        PS->AddScore(Value);
}

// 2. PlayerState에서 점수 업데이트 및 승리 체크 요청
void AMyPlayerState::AddScore(int32 Points)
{
    CurrentScore += Points;
    OnScoreChanged.Broadcast(OldScore, CurrentScore); // UI 자동 업데이트

    if (AMyGameMode* GM = GetWorld()->GetAuthGameMode<AMyGameMode>())
        GM->CheckVictoryCondition(); // 승리 조건 확인 요청
}

// 3. GameMode에서 승리 조건 확인 및 레벨 완료 처리
void AMyGameMode::CheckVictoryCondition()
{
    if (PlayerScore >= ScoreToWin)
    {
        // GameInstance에 결과 보고 및 다음 레벨로
        if (UMyGameInstance* GI = GetGameInstance<UMyGameInstance>())
        {
            GI->ReportLevelCompleted(CurrentLevel, PlayerScore);
        }
    }
}

// 4. GameInstance에서 최종 처리 및 레벨 전환
void UMyGameInstance::ReportLevelCompleted(int32 Level, int32 Score)
{
    TotalScore += Score;
    LoadNextLevel(); // 다음 레벨로
}
```


#### 언리얼 설계 사고법

- 데이터 위치 결정
	1. 생명주기 : "언제까지 살아있어야 하는가?"
		- 레벨 끝까지 : GameMode/GameState
		- 게임 끝까지 : PlayerState/GameInstance
	2. 수정권한 : "누가 바꿀 수 있는가?"
		- 게임 시스템 : GameMode가 관리
		- 플레이어 개임 : PlayerState가 관리
	3. 참조 대상 : "누가 봐야 하는가?"
		- UI 표시 : GameState/PlayerState
		- 내부 로직 : private 멤버


#### 자주하는 실수들

- 생명주기 무시 - 초기화 타이밍 실수

```
// ❌ 위험: 너무 이른 접근
void AMyGameMode::BeginPlay()
{
    // PlayerState가 없을 수 있음!
    AMyPlayerState* PS = GetFirstPlayerState(); // 크래시!
}

// ✅ 안전: 확실한 시점에서 접근
void AMyGameMode::PostLogin(APlayerController* PC)
{
    // 이 시점에서는 PlayerState 확실히 존재
    AMyPlayerState* PS = PC->GetPlayerState(); // 안전
}

```

- GameMode/GameState 조합 오류

```
// ❌ 컴파일 에러 또는 기능 누락
AGameModeBase + AGameState       // 컴파일 에러!
AGameMode + AGameStateBase       // 기능 누락!

// ✅ 올바른 조합
AGameModeBase + AGameStateBase   // 기본 기능
AGameMode + AGameState           // 완전한 기능
```

- 레벨 전환 시 데이터 손실

```
// ❌ 위험: PlayerState가 이주 중일 때 접근
void SomeFunction()
{
    AMyPlayerState* PS = GetPlayerState();
    int32 Score = PS->GetScore(); // 크래시 가능!
}

// ✅ 안전: GameInstance 백업 활용
void UMyGameInstance::GetSafePlayerScore()
{
    if (AMyPlayerState* PS = GetPlayerState())
        return PS->GetScore();    // 실시간 값
    return BackupPlayerScore;     // 백업 값
}
```

- 싱글플레이어 나쁜 습관

```
// ❌ 나쁜 예: 모든 걸 한 곳에
class AMyPlayer : public APawn
{
    int32 Score;          // PlayerState에 있어야 함
    float GameTime;       // GameState에 있어야 함
    bool bGamePaused;     // GameMode에 있어야 함
};
```

- 싱글 -> 멀티 전환의 마법 (올바른 구조의 힘)

```
// 기존 싱글플레이어 코드
void AMyPlayerState::AddScore(int32 Points)
{
    Score += Points;
    OnScoreChanged.Broadcast(Score);
}

// 멀티플레이어 - 한 줄만 추가!
void AMyPlayerState::AddScore(int32 Points)
{
    if (HasAuthority()) // 이 줄만 추가!
    {
        Score += Points;
        OnScoreChanged.Broadcast(Score);
    }
}
```

>싱글플레이어라서 대충 ***이 아니라,*** ***싱글플레이어부터 제대로***<br>
>**습관이 실력. 올바른 구조로 개발하도록 노력하자**
{: .promt-tip}
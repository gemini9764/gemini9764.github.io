---
title: 성능 최적화 (Tick, Event, Async)
description: 성능 최적화
author: gemini
date: 2025-08-12 19:00:00 +09:00
categories: [Unreal]
tags: [Performance]
math: true
mermaid: true
---

#### Tick의 숨겨진 비용

- Tick = 게임의 심장박동
	- 매 프레임마다 실행되는 함수
	- 60FPS = 초당 60번 실행
	- 30FPS = 초당 30번 실행

- 기본 Tick 구조

```cpp
void AMyActor::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);  // 부모 Tick 먼저 호출

    // DeltaTime = 이전-현재 프레임 시간차
    // 60FPS → 0.016초, 30FPS → 0.033초

    UE_LOG(LogTemp, Warning, TEXT("Tick 실행! DeltaTime: %f"), DeltaTime);
}
```

- Delta Time 활용 - 프레임 독립적 이동

```cpp
void AMyActor::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    // 나쁜 예: 프레임 의존
    SetActorLocation(GetActorLocation() + FVector(5, 0, 0));
    // 60FPS: 초당 300 이동, 30FPS: 초당 150 이동

    // 좋은 예: DeltaTime 사용
    float Speed = 100.0f;  // 초당 100 유닛
    FVector Movement = FVector(Speed * DeltaTime, 0, 0);
    SetActorLocation(GetActorLocation() + Movement);
    // 프레임과 무관하게 초당 100 이동
}
```

- Tick의 문제 - ***"쌓이면 무겁다"***

- Tick 비용 계산

```json
액터 1개      = 0.05ms
액터 100개    = 5ms 
액터 1000개   = 50ms
액터 10000개  = 500ms 
```

- 프레임 예산 (60FPS = 16.67ms)

```json
입력 처리       : 1ms
게임 로직(Tick) : 10ms ← 문제!
물리            : 3ms
AI              : 2ms
애니메이션      : 2ms
렌더링          : 5ms
-------------------
합계: 23ms → 16.67ms 초과! → FPS 하락
```

- 실제 사례 - AAA 프로젝트의 문제 코드

```cpp
// 각 몬스터의 Tick
void AMonster::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    // 문제 1: 매 프레임 플레이어 검색
    ACharacter* Player = UGameplayStatics::GetPlayerCharacter(GetWorld(), 0);
    // 200마리 × 60FPS = 초당 12,000번!

    if (Player)
    {
        // 문제 2: 매 프레임 거리 계산 (sqrt 포함)
        float Distance = FVector::Dist(GetActorLocation(), Player->GetActorLocation());
        // 200마리 × 60FPS = 초당 12,000번 sqrt!

        // 문제 3: 매 프레임 경로 탐색
        if (Distance > AttackRange)
        {
            TArray<FVector> Path = FindPathToPlayer();  // A* 알고리즘
            MoveAlongPath(Path);
        }
        else
        {
            Attack(Player);
        }
    }
}
```

*결과 : 몬스터 200마리 -> 60FPS에서 25FPS로 폭락*


#### Tick 오버헤드 확인 방법

- 방법 1: stat game

```json
` 키 → stat game 입력

Frame: 16.67ms (전체)
├─ Game: 8.5ms (Tick 포함!) ← 10ms 넘으면 문제
├─ Draw: 5.2ms
└─ GPU: 7.8ms
```

- 방법 2: 직접 측정

```cpp
void AMyActor::Tick(float DeltaTime)
{
    double StartTime = FPlatformTime::Seconds();

    // Tick 로직
    DoHeavyWork();

    double ElapsedTime = FPlatformTime::Seconds() - StartTime;
    if (ElapsedTime > 0.001)  // 1ms 이상
    {
        UE_LOG(LogTemp, Warning, TEXT("무거운 Tick: %.3f ms"),
               ElapsedTime * 1000);
    }
}
```


#### Tick 최적화 해결책

- 해결책 1: 실행 간격 조절

```cpp
// Before: 매 프레임 실행
void AEnemy::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    CheckPlayerDistance();  // 초당 60번!
    UpdateAIState();
}

// After: 0.1초마다만 실행
void AEnemy::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    TimeSinceLastUpdate += DeltaTime;

    if (TimeSinceLastUpdate >= 0.1f)  // 0.1초마다
    {
        TimeSinceLastUpdate = 0.0f;
        CheckPlayerDistance();  // 초당 10번
        UpdateAIState();
    }

    UpdateAnimation();  // 애니메이션은 매 프레임
}
```

- 권장주기
	- 매 프레임 : 입력, 카메라, 애니메이션
	- 0.05초 : 근접전투
	- 0.1초 : AI, 거리 체크
	- 0.2초~0.5초 : 미니맵, 원거리 적

- 해결책 2 : 중복 계산 제거

```cpp
// Before: 각자 계산 (200번)
void AEnemy::Tick(float DeltaTime)
{
    ACharacter* Player = UGameplayStatics::GetPlayerCharacter(GetWorld(), 0);
    FVector PlayerLoc = Player->GetActorLocation();
    float Distance = FVector::Dist(GetActorLocation(), PlayerLoc);
}

// After: 매니저가 1번 계산 → 공유
void AEnemyManager::Tick(float DeltaTime)
{
    if (!CachedPlayer)
        CachedPlayer = UGameplayStatics::GetPlayerCharacter(GetWorld(), 0);

    FVector PlayerLocation = CachedPlayer->GetActorLocation();  // 1번만

    for (AEnemy* Enemy : AllEnemies)
    {
        float Distance = FVector::Dist(Enemy->GetActorLocation(), PlayerLocation);
        Enemy->SetPlayerInfo(PlayerLocation, Distance);
    }
}
```

- 해결책 3 : 연산 최적화

```cpp
// sqrt 제거 (30% 성능 향상)
// Before
float Distance = FVector::Dist(EnemyLoc, PlayerLoc);
if (Distance < AttackRange)  // 500.0f
    Attack();

// After
float DistanceSquared = FVector::DistSquared(EnemyLoc, PlayerLoc);
if (DistanceSquared < AttackRange * AttackRange)  // 250000
    Attack();

```

```cpp
// 캐스팅 캐싱
// Before: 매번 캐스팅
void AEnemy::Tick(float DeltaTime)
{
    AActor* PlayerActor = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
    AMyPlayerCharacter* Player = Cast<AMyPlayerCharacter>(PlayerActor);
}

// After: BeginPlay에서 한 번만
void AEnemy::BeginPlay()
{
    AActor* PlayerActor = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
    CachedPlayer = Cast<AMyPlayerCharacter>(PlayerActor);
}

```

- 해결책 4 : 거리별 차등 업데이트

```cpp
void AEnemyManager::UpdateEnemies()
{
    for (AEnemy* Enemy : AllEnemies)
    {
        float Distance = FVector::Dist(Enemy->GetActorLocation(), PlayerLocation);

        if (Distance < 500.0f)       // 근거리
            Enemy->SetUpdateRate(0.033f);  // 30FPS
        else if (Distance < 1500.0f) // 중거리
            Enemy->SetUpdateRate(0.1f);    // 10FPS
        else if (Distance < 3000.0f) // 원거리
            Enemy->SetUpdateRate(0.5f);    // 2FPS
        else                          // 초원거리
            Enemy->SetUpdateRate(1.0f);    // 1FPS
    }
}

```

- 해결책 5 : 매니저 패턴

```cpp
class AEnemyManager : public AActor
{
private:
    float FastUpdateTimer = 0.0f;    // 0.05초 주기
    float NormalUpdateTimer = 0.0f;  // 0.1초 주기
    float SlowUpdateTimer = 0.0f;    // 0.5초 주기

    TArray<AEnemy*> CloseEnemies;    // 500m 이내
    TArray<AEnemy*> MediumEnemies;   // 500-1500m
    TArray<AEnemy*> FarEnemies;      // 1500m+
};

void AEnemyManager::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    FastUpdateTimer += DeltaTime;
    NormalUpdateTimer += DeltaTime;
    SlowUpdateTimer += DeltaTime;

    if (FastUpdateTimer >= 0.05f)  // 근거리
    {
        FastUpdateTimer = 0.0f;
        UpdateCloseEnemies();
    }

    if (NormalUpdateTimer >= 0.1f)  // 중거리
    {
        NormalUpdateTimer = 0.0f;
        UpdateMediumEnemies();
    }

    if (SlowUpdateTimer >= 0.5f)  // 원거리
    {
        SlowUpdateTimer = 0.0f;
        UpdateFarEnemies();
        ReclassifyEnemies();  // 거리별 재분류
    }
}

void AEnemyManager::ReclassifyEnemies()
{
    FVector PlayerLoc = CachedPlayer->GetActorLocation();

    CloseEnemies.Empty();
    MediumEnemies.Empty();
    FarEnemies.Empty();

    for (AEnemy* Enemy : AllEnemies)
    {
        float DistSqr = FVector::DistSquared(Enemy->GetActorLocation(), PlayerLoc);

        if (DistSqr < 250000.0f)  // 500^2
            CloseEnemies.Add(Enemy);
        else if (DistSqr < 2250000.0f)  // 1500^2
            MediumEnemies.Add(Enemy);
        else
            FarEnemies.Add(Enemy);
    }
}

```

- 성능 개선 결과

|최적화 방법|개선율|
|---|---|
|실행 간격 조절|**6배**|
|중복 계산 제거|**200배**|
|연산 최적화|**30%**|
|거리별 차등|**3배**|
|매니저 패턴|**10배**|


##### Tick Group으로 실행 순서 최적화

- Tick 실행 순서

```json
[프레임 시작]
↓
TG_PrePhysics (물리 전) - 입력, 이동 명령
↓
물리 엔진 계산
↓
TG_PostPhysics (물리 후) - AI, 충돌 처리 [기본값]
↓
TG_PostUpdateWork (마지막) - UI, 카메라
↓
[프레임 끝]

```

- 설정 방법

```cpp
// 플레이어 입력 - 물리 전
AMyPlayerController::AMyPlayerController()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickGroup = TG_PrePhysics;
}

// 적 AI - 물리 후 (기본값)
AEnemy::AEnemy()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickGroup = TG_PostPhysics;
}

// 카메라 - 마지막
AFollowCamera::AFollowCamera()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickGroup = TG_PostUpdateWork;
}

```


##### Tick 최적화 체크리스트

- 진단
	- Stat Game으로 Game 시간 확인 (10ms 이상 주의)
	- Stat Unit으로 자세한 분석
	- 특정 액터 Tick 시간 측정

- 최적화
	- 실행 간격 조절
	- 중복 계산 제거 (캐싱)
	- 매니저 패턴 적용
	- 거리별 차등 업데이트
	- Tick Group 설정

- 최종 성과

```json
최적화 전: 몬스터 200마리 → 25 FPS, Tick 10ms
최적화 후: 몬스터 200마리 → 60 FPS, Tick 1.2ms
성능 8배 향상!
```


##### 핵심 정리

1. Tick은 매 프레임 -> 쌓이면 무겁다
2. stat game으로 진단 -> Game 10ms 이상 주의
3. 0.1초 간격으로도 충분 -> 매 프레임 필요한지 확인
4. 매니저 패턴 -> 200개 Tick을 1개로
5. DistSquared -> sqrt 제거로 30% 향상


#### Timer Manager 마스터하기

- Timer 란?
	- Tick = 심장박동 (쉬지 않고 계속)
	- Timer = 알람시계 (필요할 때만)

|특징|Tick|Timer|
|---|---|---|
|실행 빈도|매 프레임|지정한 주기|
|CPU 부담|높음|낮음|
|용도|실시간 반응|주기적 체크|
|관리 난이도|혼란|Handle로 제어|

- SetTimer 기본 사용법

```cpp
// Enemy.h
UCLASS()
class AEnemy : public ACharacter
{
    GENERATED_BODY()
    
private:
    FTimerHandle DistanceCheckTimer; // 거리 체크 타이머 핸들
    void CheckDistanceToPlayer();    // 타이머가 실행할 함수
};

// Enemy.cpp
void AEnemy::BeginPlay()
{
    Super::BeginPlay();
    
    // 2초 후에 CheckDistanceToPlayer 한 번 실행
    GetWorld()->GetTimerManager().SetTimer(
        DistanceCheckTimer,              // 타이머 핸들
        this,                            // 함수를 실행할 객체
        &AEnemy::CheckDistanceToPlayer,  // 실행할 함수
        2.0f,                            // 대기 시간(초)
        false                            // 반복 여부 (false = 한 번만)
    );
}

void AEnemy::CheckDistanceToPlayer()
{
    UE_LOG(LogTemp, Warning, TEXT("적이 플레이어와의 거리를 체크합니다!"));
}
```

|주기(초)|초당 호출 횟수 (1/주기)|초당 총 비용 (N×비용×호출수)|프레임당 평균 비용(60FPS 기준)|소감|
|---|---|---|---|---|
|**0.016** (매 프레임)|~62.5|200 × 0.01ms × 62.5 = **125ms/s**|**~2.08ms/프레임**|프레임 예산의 12.5% 소모|
|**0.050**|20|200 × 0.01 × 20 = **40ms/s**|**~0.67ms/프레임**|여유 생김|
|**0.100**|10|200 × 0.01 × 10 = **20ms/s**|**~0.33ms/프레임**|대부분 상황에 충분|
|**0.250**|4|200 × 0.01 × 4 = **8ms/s**|**~0.13ms/프레임**|아주 가벼움|
|**1.000**|1|200 × 0.01 × 1 = **2ms/s**|**~0.03ms/프레임**|거의 공짜|

- 스파이크 방지

```cpp
void AEnemy::BeginPlay()
{
    Super::BeginPlay();

    const float Period = 0.1f;
    const float Jitter = FMath::FRandRange(0.f, Period);

    GetWorld()->GetTimerManager().SetTimer(
        DistanceCheckTimer,
        this,
        &AEnemy::CheckDistanceToPlayer,
        Period,
        true,
        Jitter  // 랜덤 초기 지연
    );
}
```

- SetTimer vs SetTimerForNextTick

```cpp
// SetTimer: 지정 시간 후 실행
GetWorld()->GetTimerManager().SetTimer(
    AttackDelayTimer, this, &AEnemy::PerformAttack, 0.5f, false
);

// SetTimerForNextTick: 다음 프레임에서 실행
GetWorld()->GetTimerManager().SetTimerForNextTick(
    this, &AEnemy::UpdateEnemyUI
);
```

- Timer Handle 안전하게 관리하기

```cpp
// 잘못된 예시
void AEnemy::StopDistanceCheck()
{
    GetWorld()->GetTimerManager().ClearTimer(DistanceCheckTimer);
    // 여기서 핸들을 초기화하지 않으면, 유효하지 않은 핸들이 남을 수 있음
}

// 올바른 예시
void AEnemy::StopDistanceCheck()
{
    if (DistanceCheckTimer.IsValid()) // 먼저 유효성 체크
    {
        GetWorld()->GetTimerManager().ClearTimer(DistanceCheckTimer);
        DistanceCheckTimer.Invalidate(); // 핸들 초기화
    }
}
```

- 더 안전한 패턴

```cpp
void AEnemy::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    GetWorld()->GetTimerManager().ClearAllTimersForObject(this);
    Super::EndPlay(EndPlayReason);
}
```


##### Lambda vs. Delegate

- Lambda 방식 - 짧고 간단한 작업에 적합

```cpp
void AEnemy::StartAttackSequence()
{
    GetWorld()->GetTimerManager().SetTimer(
        AttackTimer,
        [this]() // 람다 캡처
        {
            UE_LOG(LogTemp, Warning, TEXT("Enemy 공격!"));
            if (ACharacter* Player = UGameplayStatics::GetPlayerCharacter(GetWorld(), 0))
            {
                // Player에게 데미지
                Player->TakeDamage(AttackDamage);
            }
        },
        1.0f,
        false
    );
}
```

- Delegate 방식 - 명확하고 유지보수에 유리

```cpp
// Enemy.h
UFUNCTION()
void OnDistanceCheckTimer();

// Enemy.cpp
void AEnemy::BeginPlay()
{
    GetWorld()->GetTimerManager().SetTimer(
        DistanceCheckTimer,
        this,
        &AEnemy::OnDistanceCheckTimer,
        0.1f,
        true
    );
}

void AEnemy::OnDistanceCheckTimer()
{
    // 복잡한 로직
    CheckDistanceToPlayer();
    UpdateAIState();
    UE_LOG(LogTemp, Warning, TEXT("Enemy AI 업데이트!"));
}
```


##### Tick -> Timer 로 변경

- Before (Tick 방식)

```cpp
void AEnemy::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    
    // 매 프레임마다 Player 찾기
    ACharacter* Player = UGameplayStatics::GetPlayerCharacter(GetWorld(), 0);
    if (!Player) return;
    
    // 매 프레임마다 거리 계산
    float Distance = FVector::Dist(GetActorLocation(), Player->GetActorLocation());
    if (Distance < AttackRange)
    {
        Attack();
    }
}
```

- After (Timer 방식)

```cpp
void AEnemy::BeginPlay()
{
    Super::BeginPlay();
    
    PrimaryActorTick.bCanEverTick = false; // Tick 비활성화
    
    // 0.1초마다만 거리 체크 (초당 10번)
    GetWorld()->GetTimerManager().SetTimer(
        DistanceCheckTimer,
        this,
        &AEnemy::CheckDistanceToPlayer,
        0.1f,
        true
    );
}

void AEnemy::CheckDistanceToPlayer()
{
    ACharacter* Player = UGameplayStatics::GetPlayerCharacter(GetWorld(), 0);
    if (!Player) return;
    
    float Distance = FVector::Dist(GetActorLocation(), Player->GetActorLocation());
    
    if (Distance < AttackRange)
    {
        Attack();
        
        // 공격 중에는 거리 체크 중단
        GetWorld()->GetTimerManager().PauseTimer(DistanceCheckTimer);
        
        // 2초 후 다시 거리 체크 재개
        FTimerHandle ResumeTimer;
        GetWorld()->GetTimerManager().SetTimer(
            ResumeTimer,
            [this]()
            {
                GetWorld()->GetTimerManager().UnPauseTimer(DistanceCheckTimer);
            },
            2.0f,
            false
        );
    }
}

void AEnemy::Attack()
{
    UE_LOG(LogTemp, Warning, TEXT("Enemy가 Player를 공격합니다!"));
    // 공격 애니메이션 재생
    // Player에게 데미지 전달
}
```

- 성능 개선

```json
Tick 방식: 60회/초 → Timer 방식: 10회/초
CPU 부하 약 6배 감소
Enemy 200마리 기준: 12,000회/초 → 2,000회/초
```

>Timer 사용 시 실무 팁<br>
>**주기 조절** -> Enemy AI는 0.1초마다 체크로 충분, 매 프레임 불필요<br>
>**모든 타이머 종료** - Enemy `EndPlay`에서 ClearAllTimerForObject 호출<br>
>**핸들 유효성 확인** - `IsValid()`로 체크 후 조작<br>
>**람다 남용 주의** - Enemy 수명이 보장되지 않으면 크래시 위험<br>
{: .prompt-tip}


#### 이벤트 기반 아키텍처

##### 폴링 vs 이벤트

- 폴링 (Polling)

```cpp
// 나쁜 예시 - 폴링 방식
void AEnemy::Tick(float DeltaTime)
{
    // 매 프레임 확인
    if (Player && Player->GetHealth() <= 0)
    {
        StopChasing();
        PlayVictoryAnimation();
    }
}
```

- 이벤트 (Event)

```cpp
// 좋은 예시 - 이벤트 방식
void APlayer::TakeDamage(float Damage)
{
    Health -= Damage;
    
    if (Health <= 0)
    {
        OnPlayerDied.Broadcast(); // 이벤트 발생!
    }
}

// Enemy는 이벤트 구독
void AEnemy::BeginPlay()
{
    if (APlayer* Player = GetPlayer())
    {
        Player->OnPlayerDied.AddUObject(this, &AEnemy::OnPlayerDeath);
    }
}

void AEnemy::OnPlayerDeath()
{
    StopChasing();
    PlayVictoryAnimation();
}
```


##### Delegate - 언리얼식 함수 포인터

```cpp
// 1. Delegate 선언
DECLARE_DELEGATE_OneParam(FOnPlayerHealthChanged, float);

// 2. Player 클래스에 Delegate 변수 추가
UCLASS()
class APlayer : public ACharacter
{
public:
    FOnPlayerHealthChanged OnHealthChanged;
    
private:
    float Health = 100.0f;

public:
    void TakeDamage(float Damage);
};

// 3. 이벤트 발생시키기 (Enemy가 공격했을 때)
void APlayer::TakeDamage(float Damage)
{
    Health -= Damage;

    if (OnHealthChanged.IsBound())
    {
        OnHealthChanged.Execute(Health);
    }
}

// 4. Enemy에서 구독 (Player 체력 변화 감지)
void AEnemy::BeginPlay()
{
    if (APlayer* Player = Cast<APlayer>(UGameplayStatics::GetPlayerCharacter(GetWorld(), 0)))
    {
        Player->OnHealthChanged.BindUObject(this, &AEnemy::OnPlayerHealthChanged);
    }
}

void AEnemy::OnPlayerHealthChanged(float NewHealth)
{
    // Player 체력에 따라 Enemy 행동 변경
    if (NewHealth < 30.0f)
    {
        SetAggressive(true);  // Player가 약해지면 공격적으로
    }
}
```


##### Multicast Delegate - 여러 구독자 호출

```cpp
// 선언
DECLARE_MULTICAST_DELEGATE_OneParam(FOnEnemyKilled, AEnemy*);

// Player 클래스에서 Enemy 처치 이벤트
class APlayer : public ACharacter
{
public:
    FOnEnemyKilled OnEnemyKilled;
    
    void KillEnemy(AEnemy* Enemy)
    {
        OnEnemyKilled.Broadcast(Enemy);
    }
};

// 여러 시스템이 Enemy 죽음 이벤트 구독
Player->OnEnemyKilled.AddUObject(ScoreManager, &AScoreManager::AddScore);
Player->OnEnemyKilled.AddUObject(UIManager, &AUIManager::ShowKillNotification);
Player->OnEnemyKilled.AddUObject(AudioManager, &AAudioManager::PlayKillSound);
Player->OnEnemyKilled.AddUObject(SpawnManager, &ASpawnManager::OnEnemyDeath);

// Enemy가 죽으면 모든 시스템에 알림
void AEnemy::Die()
{
    if (APlayer* Player = GetKiller())
    {
        Player->OnEnemyKilled.Broadcast(this);
    }
    Destroy();
}
```


##### Dynamic Multicast Delegate - 블루프린트 호환

```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnEnemySpotted, AEnemy*, Enemy);

UCLASS()
class AEnemy : public ACharacter
{
public:
    UPROPERTY(BlueprintAssignable, Category = "Enemy Events")
    FOnEnemySpotted OnPlayerSpotted;
    
    void SpotPlayer()
    {
        OnPlayerSpotted.Broadcast(this);
    }
};
```

| Delegate 종류       | 구독자 수 | Blueprint | 성능  |
| ----------------- | ----- | --------- | --- |
| Delegate          | 1개    | X         | 최고  |
| Multicast         | 여러개   | X         | 좋음  |
| Dynamic Multicast | 여러개   | O         | 보통  |

##### Event Bus 패턴 - 중앙 집중형 이벤트 관리

```cpp
UCLASS()
class UGameEventBus : public UObject
{
    GENERATED_BODY()
    
public:
    static UGameEventBus* GetInstance();

    // Enemy 관련 이벤트들
    DECLARE_MULTICAST_DELEGATE_OneParam(FOnEnemyKilled, AEnemy*);
    DECLARE_MULTICAST_DELEGATE_TwoParams(FOnEnemyDamaged, AEnemy*, float);
    DECLARE_MULTICAST_DELEGATE_OneParam(FOnEnemySpawned, AEnemy*);
    
    FOnEnemyKilled OnEnemyKilled;
    FOnEnemyDamaged OnEnemyDamaged;
    FOnEnemySpawned OnEnemySpawned;

private:
    static UGameEventBus* Instance;
};
```

```cpp
// Enemy 죽음 발행(?)
void AEnemy::Die()
{
    UGameEventBus::GetInstance()->OnEnemyKilled.Broadcast(this);
    Destroy();
}
```

```cpp
// 다른 Enemy들이 구독
void AEnemy::BeginPlay()
{
    UGameEventBus::GetInstance()->OnEnemyKilled.AddUObject(this, &AEnemy::OnOtherEnemyKilled);
}

void AEnemy::OnOtherEnemyKilled(AEnemy* DeadEnemy)
{
    // 동료가 죽으면 경계 레벨 상승
    if (FVector::Dist(GetActorLocation(), DeadEnemy->GetActorLocation()) < 1000.0f)
    {
        AlertLevel = FMath::Min(AlertLevel + 1, MaxAlertLevel);
    }
}
```

- 주의 사항
	1.  **메모리 누수** : Enemy가 죽을 때 이벤트 구독 해체 필수
	```cpp
	void AEnemy::EndPlay(const EEndPlayReason::Type EndPlayReason)
	{
	    UGameEventBus::GetInstance()->OnEnemyKilled.RemoveAll(this);
	    Super::EndPlay(EndPlayReason);
	}
	```
	2. **순환 참조** : 이벤트 처리 중 또 다른 이벤트를 바로 발행하면 무한 루프 가능 -> `SetTimerForNextTick`으로 지연


##### 폴링 -> 이벤트 전환

- Before (폴링)

```cpp
void AEnemy::Tick(float DeltaTime)
{
    // Enemy 200마리가 매 프레임 Player 체력 체크
    if (Player)
    {
        float PlayerHealth = Player->GetHealth();
        if (PlayerHealth != LastKnownPlayerHealth)
        {
            if (PlayerHealth < 30.0f)
            {
                SetAggressive(true);
            }
            LastKnownPlayerHealth = PlayerHealth;
        }
    }
}
```

- After (이벤트)

```cpp
// Player에서 이벤트 발생
void APlayer::TakeDamage(float Damage)
{
    float OldHealth = Health;
    Health = FMath::Clamp(Health - Damage, 0.0f, MaxHealth);

    if (OldHealth != Health)
    {
        OnHealthChanged.Broadcast(Health, MaxHealth);
        
        // 체력이 낮아지면 Enemy들에게 알림
        if (Health < 30.0f && OldHealth >= 30.0f)
        {
            OnPlayerWeakened.Broadcast();
        }
    }
}

// Enemy는 이벤트 구독
void AEnemy::BeginPlay()
{
    PrimaryActorTick.bCanEverTick = false;  // Tick 비활성화!

    if (APlayer* Player = Cast<APlayer>(UGameplayStatics::GetPlayerCharacter(GetWorld(), 0)))
    {
        Player->OnHealthChanged.AddUObject(this, &AEnemy::OnPlayerHealthChanged);
        Player->OnPlayerWeakened.AddUObject(this, &AEnemy::OnPlayerWeakened);
    }
}

void AEnemy::OnPlayerWeakened()
{
    // Player가 약해졌을 때만 반응
    SetAggressive(true);
    IncreaseAttackSpeed();
}
```

- 효과 : 불필요한 Tick 제거, 성능 최대 60배 향상

- 결론
	- 폴링 : 간단하지만 성능 불리
	- 이벤트 : CCPU 부하↓, 코드 구조↑
	- 상황별 : Delegate 선택
	- 규모 크면 Event Bus


#### 비동기 처리와 스레드

##### 게임이 멈추는 이유

- 싱글 스레드의 한계

```json
[싱글 스레드 = 요리사 1명]
손님1: "파스타" (3분)
손님2: "피자" (5분)
손님3: "샐러드" (1분)

→ 순서대로 처리: 파스타(3분) → 피자(5분) → 샐러드(1분)
→ 샐러드 손님은 9분 대기! 😱
```

- 동기 vs 비동기
	- 동기

	```cpp
	void LoadDataSync()
	{
	    LoadFile();      // 5초 걸림 → 게임 정지
	    ProcessData();   // 3초 걸림 → 계속 정지
	    DisplayResult(); // 1초 걸림 → 여전히 정지
	    // 총 9초 동안 게임 프리징! 💀
	}
	```
	
	- 비동기

	```cpp
	void LoadDataAsync()
	{
	    AsyncLoadFile([this]()
	    {
	        ProcessData();
	        DisplayResult();
	    });
	    // 즉시 리턴, 게임은 계속 실행! 
	}
	```

- 60FPS 유지 조건
	- 1프레임  = 16.67ms 이내
	- 100ms 작업 = 6프레임 손실 = 눈에 띄는 끊김


##### 언리얼 멀티스레드 구조

- 주요 스레드 소개

```json
[Game Thread] - "감독"
├─ 게임 로직 처리
├─ 입력 처리
├─ UI 업데이트
└─ UObject 생성/삭제

[Render Thread] - "그래픽 담당"
├─ 드로우 콜 준비
├─ 머티리얼 처리
└─ 렌더 커맨드 생성

[RHI Thread] - "GPU 통역사"
├─ DirectX/Vulkan 명령 변환
└─ GPU에 실제 명령 전달

[Audio Thread] - "사운드 엔지니어"
├─ 오디오 믹싱
├─ 3D 사운드 계산

[Worker Threads] - "일꾼들" (CPU 코어 수만큼)
├─ 물리 계산
├─ AI 경로 탐색
├─ 파일 로딩
└─ 기타 백그라운드 작업
```

- 현재 스레드 확인하기

```cpp
void CheckCurrentThread()
{
    if (IsInGameThread())
    {
        UE_LOG(LogTemp, Warning, TEXT("게임 스레드입니다"));
    }
    else if (IsInRenderingThread())
    {
        UE_LOG(LogTemp, Warning, TEXT("렌더 스레드입니다"));
    }
    else
    {
        uint32 ThreadId = FPlatformTLS::GetCurrentThreadId();
        UE_LOG(LogTemp, Warning, TEXT("워커 스레드 #%d입니다"), ThreadId);
    }
}
```


##### 스레드별 할 수 있는 일 vs 하면 안되는 일

- Game Thread에서만 가능한 작업

```cpp
// Game Thread에서만 가능한 것들
void GameThreadOnly()
{
    // Enemy 스폰
    AEnemy* NewEnemy = GetWorld()->SpawnActor<AEnemy>();
    
    // UI 조작
    EnemyCountWidget->SetText(FText::AsNumber(EnemyCount));
    
    // 컴포넌트 추가/제거
    UStaticMeshComponent* Mesh = NewObject<UStaticMeshComponent>(this);
    
    // 대부분의 언리얼 API
    UGameplayStatics::GetPlayerController(GetWorld(), 0);
}
```

- 모든 스레드에서 가능한 작업

```cpp
// 모든 스레드에서 가능
void AnyThreadSafe()
{
    // Enemy AI 경로 계산 (순수 연산)
    FVector PathToPlayer = CalculatePath(EnemyPos, PlayerPos);
    
    // Enemy 배열 정렬 (동시 접근만 조심)
    TArray<FEnemyData> EnemyData = GetEnemyData();
    EnemyData.Sort([](const FEnemyData& A, const FEnemyData& B)
    {
        return A.DistanceToPlayer < B.DistanceToPlayer;
    });
    
    // Enemy 데이터 파일 읽기
    FString EnemyConfig;
    FFileHelper::LoadFileToString(EnemyConfig, TEXT("EnemyData.json"));
}
```

- 절대 하면 안되는 것

```cpp
// 다른 스레드에서 이러면 크래시!
void WillCrashInWorkerThread()
{
    // Enemy 생성 시도
    AEnemy* Enemy = NewObject<AEnemy>();  // 크래시!
    
    // World에서 Enemy 스폰
    GetWorld()->SpawnActor<AEnemy>();     // 크래시!
    
    // Enemy UI 조작
    EnemyHealthBar->SetPercent(0.5f);     // 크래시!
}
```


##### 실전 : 무거운 작업을 백그라운드로

- 시나리오 : 1만 개 아이템 정렬

- 나쁜 예 (메인 스레드)

```cpp
void AEnemyManager::UpdateAllEnemyPaths()
{
    // 이 순간 게임이 멈춤!
    for (AEnemy* Enemy : AllEnemies)
    {
        if (Enemy)
        {
            // 복잡한 A* 경로 탐색 (Enemy당 0.5ms)
            TArray<FVector> Path = FindPathToPlayer(Enemy);
            Enemy->SetPath(Path);
        }
    }
    // 200마리 × 0.5ms = 100ms (6프레임 정지!)
}
```

- 좋은 예 (백그라운드)

```cpp
void AEnemyManager::UpdateAllEnemyPathsAsync()
{
    // 1. Enemy 데이터 복사 (스레드 안전)
    TArray<FEnemyPathData> EnemyDataCopy;
    for (AEnemy* Enemy : AllEnemies)
    {
        if (Enemy)
        {
            FEnemyPathData Data;
            Data.EnemyID = Enemy->GetUniqueID();
            Data.StartLocation = Enemy->GetActorLocation();
            Data.TargetLocation = Player->GetActorLocation();
            EnemyDataCopy.Add(Data);
        }
    }
    
    // 2. 백그라운드에서 경로 계산
    Async(EAsyncExecution::ThreadPool, [this, EnemyDataCopy]()
    {
        // 여기는 Worker Thread! 게임은 계속 돌아감
        TArray<FEnemyPathResult> PathResults;
        
        for (const FEnemyPathData& Data : EnemyDataCopy)
        {
            FEnemyPathResult Result;
            Result.EnemyID = Data.EnemyID;
            Result.Path = CalculatePathAStar(Data.StartLocation, Data.TargetLocation);
            PathResults.Add(Result);
        }
        
        // 3. Game Thread로 돌아와서 Enemy에 경로 적용
        AsyncTask(ENamedThreads::GameThread, [this, PathResults]()
        {
            for (const FEnemyPathResult& Result : PathResults)
            {
                if (AEnemy* Enemy = FindEnemyByID(Result.EnemyID))
                {
                    Enemy->SetPath(Result.Path);
                }
            }
        });
    });
}
```


##### Async vs AsyncTask vs UE::Tasks 비교

- Async() -> 간단한 백그라운드 작업

```cpp
// Enemy 거리 정렬
Async(EAsyncExecution::ThreadPool, [this]()
{
    // Enemy 200마리 거리순 정렬
    SortEnemiesByDistance();
});

// 실행 옵션
EAsyncExecution::Thread           // 새 스레드 생성 (대량 Enemy 처리)
EAsyncExecution::ThreadPool       // 기존 워커 풀 사용 (일반적)
EAsyncExecution::ThreadIfForkSafe // 조건부 스레드
EAsyncExecution::TaskGraph        // 태스크 그래프 사용
EAsyncExecution::TaskGraphMainThread // 게임 스레드로 예약
```

- AsyncTask() - 특정 스레드 지정

```cpp
// Enemy 처치 후 UI 업데이트
AsyncTask(ENamedThreads::GameThread, [this]()
{
    // Enemy 카운트 UI 업데이트 (Game Thread 전용)
    EnemyCountWidget->SetText(FText::AsNumber(--RemainingEnemies));
});

// Enemy AI 계산을 백그라운드로
AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, [this]()
{
    // Enemy 200마리 다음 행동 계산
    CalculateAllEnemyNextActions();
});
```

- UE::Tasks - 차세대 태스크 시스템 (UE5)

```cpp
#include "Tasks/Task.h"

// Enemy 스폰 → 초기화 → AI 설정 체이닝
UE::Tasks::Launch(UE_SOURCE_LOCATION, 
    []() { return LoadEnemyData(); })
    .Then(UE_SOURCE_LOCATION, 
    [](auto Data) { return InitializeEnemies(Data); })
    .Then(UE_SOURCE_LOCATION, 
    [](auto Enemies) { SetupEnemyAI(Enemies); });

// Enemy 200마리 병렬 처리
TArray<UE::Tasks::FTask> EnemyTasks;
for (int i = 0; i < 200; ++i)
{
    EnemyTasks.Add(UE::Tasks::Launch(UE_SOURCE_LOCATION, [i]()
    {
        return ProcessEnemyAI(i);
    }));
}
UE::Tasks::WaitAll(EnemyTasks);  // 모든 Enemy AI 완료 대기

```

- 성능 & 사용성 비교

| 기능        | Async() | AsyncTask() | UE::Tasks |
| --------- | ------- | ----------- | --------- |
| **난이도**   | 쉬움      | 보통          | 어려움       |
| **성능**    | 좋음      | 좋음          | 최고        |
| **체이닝**   | X       | X           | O         |
| **병렬 처리** | 수동      | 수동          | 자동 지원     |
| **취소 가능** | X       | X           | O         |
| **언제부터**  | UE4     | UE4         | UE5       |


##### 실전 예제 : 대용량 파일 로딩

- 시나리오 500MB 세이브 파일

- 동기 방식 (게임 정지)

```cpp
void AEnemySpawner::SpawnEnemyWave()
{
    // 이 순간 3~5초 동안 게임 정지!
    for (int i = 0; i < 500; i++)
    {
        FVector SpawnLocation = CalculateSpawnPosition(i);
        AEnemy* Enemy = GetWorld()->SpawnActor<AEnemy>(EnemyClass, SpawnLocation);
        Enemy->Initialize();  // 각 Enemy 초기화 (AI, 무기, 스탯)
    }
    // 총 3초 프리징
}
```

- 비동기 방식 (부드러운 로딩)

```cpp
void AEnemySpawner::SpawnEnemyWaveAsync()
{
    // 1. 스폰 준비 알림
    ShowWaveWarning(TEXT("Enemy Wave Incoming!"));
    
    // 2. 백그라운드에서 스폰 위치 계산
    Async(EAsyncExecution::ThreadPool, [this]()
    {
        TArray<FVector> SpawnPositions;
        
        // 500개 위치 미리 계산
        for (int i = 0; i < 500; i++)
        {
            SpawnPositions.Add(CalculateSpawnPosition(i));
        }
        
        // 3. Game Thread에서 배치로 스폰
        AsyncTask(ENamedThreads::GameThread, [this, SpawnPositions]()
        {
            // 50마리씩 나눠서 스폰 (프레임 분산)
            const int BatchSize = 50;
            int CurrentBatch = 0;
            
            FTimerHandle SpawnTimer;
            GetWorld()->GetTimerManager().SetTimer(SpawnTimer, 
                [this, SpawnPositions, CurrentBatch, BatchSize]() mutable
                {
                    int StartIdx = CurrentBatch * BatchSize;
                    int EndIdx = FMath::Min(StartIdx + BatchSize, SpawnPositions.Num());
                    
                    for (int i = StartIdx; i < EndIdx; i++)
                    {
                        AEnemy* Enemy = GetWorld()->SpawnActor<AEnemy>(
                            EnemyClass, SpawnPositions[i]);
                        
                        // Enemy AI는 비동기로 초기화
                        InitializeEnemyAsync(Enemy);
                    }
                    
                    CurrentBatch++;
                    
                    if (CurrentBatch >= 10) // 500/50 = 10배치
                    {
                        GetWorld()->GetTimerManager().ClearTimer(SpawnTimer);
                        OnWaveSpawnComplete.Broadcast();
                    }
                },
                0.1f,  // 0.1초마다 50마리씩
                true
            );
        });
    });
}

// Enemy AI 비동기 초기화
void AEnemySpawner::InitializeEnemyAsync(AEnemy* Enemy)
{
    // Enemy 데이터 복사
    int32 EnemyID = Enemy->GetUniqueID();
    FVector EnemyPos = Enemy->GetActorLocation();
    
    Async(EAsyncExecution::ThreadPool, [this, EnemyID, EnemyPos]()
    {
        // AI 경로, 행동 트리 등 계산
        FAIData AIData = CalculateAIData(EnemyPos);
        
        AsyncTask(ENamedThreads::GameThread, [this, EnemyID, AIData]()
        {
            if (AEnemy* Enemy = FindEnemyByID(EnemyID))
            {
                Enemy->SetupAI(AIData);
            }
        });
    });
}
```


##### 스레드 안전 (Thread Safety) 실수 방지

- 자주하는 실수들

1. Enemy를 다른 스레드에서 접근

```cpp
// 절대 금지!
Async(EAsyncExecution::ThreadPool, [this]()
{
    // Enemy는 UObject인데 Worker Thread에서 접근
    Enemy->SetHealth(50);  // 크래시 또는 메모리 오염
});

// 올바른 방법
Async(EAsyncExecution::ThreadPool, [this]()
{
    int32 NewHealth = CalculateEnemyHealth();  // 로컬 변수로 계산
    
    AsyncTask(ENamedThreads::GameThread, [this, NewHealth]()
    {
        Enemy->SetHealth(NewHealth);  // Game Thread에서 적용
    });
});
```

2. Enemy 배열 동시 접근

```cpp
// 위험한 코드
TArray<AEnemy*> AllEnemies;

// Thread 1
Async(EAsyncExecution::ThreadPool, [&AllEnemies]()
{
    AllEnemies.Add(NewEnemy);  // 동시 접근 시 크래시!
});

// Thread 2  
Async(EAsyncExecution::ThreadPool, [&AllEnemies]()
{
    AllEnemies.RemoveAt(0);  // 크래시!
});

// 안전한 방법 1: 복사본 사용
TArray<AEnemy*> EnemiesCopy = AllEnemies;
Async(EAsyncExecution::ThreadPool, [EnemiesCopy]() mutable
{
    // 복사본 처리
    ProcessEnemies(EnemiesCopy);
});

// 안전한 방법 2: 크리티컬 섹션
FCriticalSection EnemyLock;
Async(EAsyncExecution::ThreadPool, [&AllEnemies, &EnemyLock]()
{
    FScopeLock Lock(&EnemyLock);  // 잠금
    AllEnemies.Add(NewEnemy);     // 한 번에 하나씩만
});
```

3. Enemy AI 결과 동기화 실패

```cpp
// 잘못된 코드
TArray<FVector> EnemyPaths;
Async(EAsyncExecution::ThreadPool, [&EnemyPaths]()
{
    // Enemy 200마리 경로 계산...
    EnemyPaths = CalculateAllPaths();
});
ApplyPathsToEnemies(EnemyPaths);  // 아직 계산 안 끝났는데 사용! 💥

// 올바른 방법: 콜백 사용
Async(EAsyncExecution::ThreadPool, []()
{
    TArray<FVector> EnemyPaths = CalculateAllPaths();
    
    AsyncTask(ENamedThreads::GameThread, [EnemyPaths]()
    {
        ApplyPathsToEnemies(EnemyPaths);  // 계산 끝나고 사용
    });
});
```


##### 언제 어떤 방법을 쓸까?

- 결정 가이드

```py
Q: 작업이 0.1초 이상 걸리나?
├─ NO -> 그냥 메인 스레드에서 처리
└─ YES ↓

Q: UObject/UI를 다루나?
├─ YES -> Timer나 Tick 사용 (비동기 불가)
└─ NO ↓

Q: 단순한 일회성 작업인가?
├─ YES -> Async() 사용
└─ NO ↓

Q: 여러 단계가 연결되나?
├─ YES -> UE::Tasks 사용
└─ NO → AsyncTask() 사용
```

>황금 규칙<br>
>1. **의심되면 Game Thread에서** - 크래시보다는 느린 게 낫다<br>
>2. **UI는 항상 Game Thread** - 예외없음<br>
>3. **데이터는 복사해서 전달** - 공유보다 복사가 안전<br>
>4. **작업 완료를 확인** - 비동기는 "언제 끝날지 모른다"<br>
>5. **프로파일링으로 검증** - 추측 말고 추정<br>
{: .prompt-info}

>핵심 포인트<br>
>비동기는 강력하지만, 잘못 쓰면 디버깅 지옥<br>
>하지만 제대로 쓰면 0.1초 멈추던 게임이 60FPS를 유지<br>
>이게 바로 AAA 게임과 인디 게임의 차이를 만드는 기술이다<br>
{: .prompt-tip}
---
title: CPU와 아키텍처 최적화
description: 최적화
author: gemini
date: 2025-09-19 19:00:00 +09:00
categories: [Unreal]
tags: [Optimization]
math: true
mermaid: true
---

#### 프레임 예산과 시간의 중요성

##### 프레임 예산 - 우리에게 주어진 시간

- 60fps 게임에서 한 프레임당 16.67ms가 주어지고 120fps에서는 8.33ms만 주어진다
- 이 제한된 시간 안에 다음 작업들을 모두 완료
	- 입력 처리
	- 게임 로직
	- 물리 시뮬레이션
	- 애니메이션
	- 오디오
	- 렌더링

- 언리얼의 프레임 처리 과정

```
// 언리얼 엔진 내부 프레임 처리 (단순화)
void UWorld::Tick(float DeltaTime)
{
    // 1. 모든 액터의 Tick 호출
    for (AActor* Actor : AllActors)
    {
        if (Actor->CanEverTick())
        {
            Actor->Tick(DeltaTime);  // 여러분의 코드가 여기서 실행
        }
    }

    // 2. 모든 컴포넌트의 Tick 호출
    for (UActorComponent* Component : AllComponents)
    {
        if (Component->CanEverTick())
        {
            Component->TickComponent(DeltaTime);
        }
    }

    // 3. 타이머 처리
    TimerManager.Tick(DeltaTime);
}
```


##### 초보자들의 흔한 실수들

1. 무조건 Tick 켜기

```
// 잘못된 예시
AMyActor::AMyActor()
{
    PrimaryActorTick.bCanEverTick = true;  // 일단 켜놓고 보자 ㅋㅋㅋ
}

void AMyActor::Tick(float DeltaTime)
{
    if (SomeCondition)
    {
        DoSomething();
    }
    // 대부분의 시간에는 아무것도 안 함
}
```

2. 매 프레임 동적 할당

```
// 끔찍한 예시
void AWeapon::Tick(float DeltaTime)
{
    TArray<AActor*>* NearbyEnemies = new TArray<AActor*>();  // 매 프레임 할당
    FindNearbyEnemies(*NearbyEnemies);
    delete NearbyEnemies;  // 매 프레임 삭제
}
```

3. 편하니까 맵 쓰자

```
// 맵 중독자
class AGameManager : public AActor
{
    TMap<int32, APlayer*> Players;
    
public:
    void Tick(float DeltaTime) override
    {
        // 매 프레임 모든 플레이어 찾기
        for (int32 i = 0; i < 1000; ++i)
        {
            APlayer* Player = Players.Find(i);  // 매번 해시 계산
            if (Player)
            {
                UpdatePlayer(Player);
            }
        }
    }
};
```

4. 매 프레임 거리 체크

```
// 거리 체크 중독자
void AEnemy::Tick(float DeltaTime)
{
    APawn* Player = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
    if (Player)
    {
        float Distance = GetDistanceTo(Player);  // 제곱근 계산 ㅠㅠ
        if (Distance < AttackRange)
        {
            Attack();
        }
    }
}
```


#### 수천 개 액터 관리 전략

##### 원칙 1: 비활성화가 기본값

```
// 올바른 기본 설정
AMyActor::AMyActor()
{
    PrimaryActorTick.bCanEverTick = false;  // 기본적으로 끄기
    PrimaryActorTick.bStartWithTickEnabled = false;
    
    // 컴포넌트도 마찬가지임
    MyComponent = CreateDefaultSubobject<UMyComponent>(TEXT("MyComponent"));
    MyComponent->PrimaryComponentTick.bCanEverTick = false;
}
```

- 상황에 따른 Tick 제어

```
// 스마트한 Tick 관리
class ASmartEnemy : public ACharacter
{
private:
    bool bIsInCombat = false;
    bool bPlayerNearby = false;
    float LastPlayerCheckTime = 0.0f;

public:
		ASmartEnemy()
    {
        PrimaryActorTick.bCanEverTick = false;  // 기본은 꺼짐
    }
    
    void StartCombat()
    {
        if (!bIsInCombat)
        {
            bIsInCombat = true;
            SetActorTickEnabled(true);  // 전투할 때만 켜기
        }
    }

    void EndCombat()
    {
        if (bIsInCombat)
        {
            bIsInCombat = false;
            SetActorTickEnabled(false);  // 즉시 끄기
        }
    }

    UFUNCTION()
    void OnPlayerEnterDetectionRange(UPrimitiveComponent* OverlappedComp,
                                   AActor* OtherActor, ...)
    {
        if (Cast<APawn>(OtherActor))
        {
            bPlayerNearby = true;
            SetActorTickEnabled(true);
            PrimaryActorTick.TickInterval = 0.5f;  // 0.5초마다 체크
        }
    }

    UFUNCTION()
    void OnPlayerExitDetectionRange(UPrimitiveComponent* OverlappedComp,
                                  AActor* OtherActor, ...)
    {
        if (Cast<APawn>(OtherActor))
        {
            bPlayerNearby = false;
            if (!bIsInCombat)
            {
                SetActorTickEnabled(false);
            }
        }
    }
    
    void Tick(float DeltaTime) override
    {
        Super::Tick(DeltaTime);
        
        if (bIsInCombat)
        {
            // 전투 로직 - 매 프레임 실행
            ProcessCombat(DeltaTime);
        }
        else if (bPlayerNearby)
        {
            // 플레이어 근처에 있을 때 - 가끔씩 체크
            CheckForCombatStart();
        }
    }
};
```


##### 원칙 2: 업데이트 빈도 조절하기 (LOD of Logic)

```
// 스마트한 LOD 시스템
class ASmartNPC : public ACharacter
{
private:
    enum class ELogicLOD : uint8
    {
        VeryHigh,    // 매 프레임
        High,        // 0.1초마다
        Medium,      // 0.5초마다
        Low,         // 2.0초마다
        Disabled     // 업데이트 안 함
    };

    ELogicLOD CurrentLOD = ELogicLOD::Disabled;

public:
    void BeginPlay() override
    {
        Super::BeginPlay();
        
        // 1초마다 거리 체크해서 LOD 조절
        GetWorld()->GetTimerManager().SetTimer(
            DistanceCheckTimer,
            this,
            &ASmartNPC::UpdateLogicLOD,
            1.0f,  // 1초마다
            true   // 반복
        );
    }

    void UpdateLogicLOD()
    {
        APawn* Player = GetWorld()->GetFirstPlayerController()->GetPawn();
        if (!Player) return;

        float DistanceSquared = FVector::DistSquared(
            GetActorLocation(),
            Player->GetActorLocation()
        );

        ELogicLOD NewLOD;

        if (DistanceSquared < 1000000.0f)  // 10미터 이내
        {
            NewLOD = ELogicLOD::VeryHigh;
        }
        else if (DistanceSquared < 9000000.0f)  // 30미터 이내
        {
            NewLOD = ELogicLOD::High;
        }
        else if (DistanceSquared < 25000000.0f)  // 50미터 이내
        {
            NewLOD = ELogicLOD::Medium;
        }
        else if (DistanceSquared < 100000000.0f)  // 100미터 이내
        {
            NewLOD = ELogicLOD::Low;
        }
        else
        {
            NewLOD = ELogicLOD::Disabled;
        }

        if (NewLOD != CurrentLOD)
        {
            SetLogicLOD(NewLOD);
        }
    }

    void SetLogicLOD(ELogicLOD NewLOD)
    {
        CurrentLOD = NewLOD;

        switch (NewLOD)
        {
            case ELogicLOD::VeryHigh:
                PrimaryActorTick.TickInterval = 0.0f;  // 매 프레임
                SetActorTickEnabled(true);
                break;

            case ELogicLOD::High:
                PrimaryActorTick.TickInterval = 0.1f;  // 초당 10회
                SetActorTickEnabled(true);
                break;

            case ELogicLOD::Medium:
                PrimaryActorTick.TickInterval = 0.5f;  // 초당 2회
                SetActorTickEnabled(true);
                break;

            case ELogicLOD::Low:
                PrimaryActorTick.TickInterval = 2.0f;  // 0.5초마다
                SetActorTickEnabled(true);
                break;

            case ELogicLOD::Disabled:
                SetActorTickEnabled(false);
                break;
        }
    }
    
    void Tick(float DeltaTime) override
    {
        Super::Tick(DeltaTime);
        
        // LOD에 따라 다른 수준의 업데이트
        switch (CurrentLOD)
        {
            case ELogicLOD::VeryHigh:
                // 풀 업데이트 - 모든 AI 로직
                UpdateAI_Full(DeltaTime);
                UpdateAnimation_Full(DeltaTime);
                UpdateSound_Full(DeltaTime);
                break;
                
            case ELogicLOD::High:
                // 높은 수준 - AI와 애니메이션
                UpdateAI_High(DeltaTime);
                UpdateAnimation_Simple(DeltaTime);
                break;
                
            case ELogicLOD::Medium:
                // 중간 수준 - 기본 AI만
                UpdateAI_Simple(DeltaTime);
                break;
                
            case ELogicLOD::Low:
                // 낮은 수준 - 최소한의 상태 체크만
                UpdateStatus_Minimal(DeltaTime);
                break;
        }
    }
    
    void ASmartNPC::CheckVisibility()
		{
		    // 0.1초 이내에 렌더링되었는지 확인
		    bool bRecentlyRendered = WasRecentlyRendered(0.1f);
		    
		    if (bRecentlyRendered)
		    {
		        // 화면에 보임 - 정상 LOD 적용
		        UpdateLogicLOD();  
		    }
		    else
		    {
		        // 화면에 안 보임 - 강제로 낮은 LOD
		        if (CurrentLOD < ELogicLOD::Low)
		        {
		            SetLogicLOD(ELogicLOD::Low);
		        }
		    }
		}
};
```


##### 원칙 3: 이벤트 드리븐 아키텍처

- 폴링 방식과 이벤트 방식 비교

```
// 폴링 방식 - 매 프레임 체크 (X)
class AEnemyPolling : public ACharacter
{
public:
    void Tick(float DeltaTime) override
    {
        APawn* Player = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
        if (Player)
        {
            float Distance = GetDistanceTo(Player);  // 제곱근 계산!
            if (Distance < AttackRange)
            {
                if (!bIsAttacking)
                {
                    StartAttack();
                }
            }
            else
            {
                if (bIsAttacking)
                {
                    StopAttack();
                }
            }
        }
    }
};
```

```
// 이벤트 방식 - 필요할 때만 실행 (O)
class AEnemyEvent : public ACharacter
{
private:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Detection")
    class USphereComponent* DetectionSphere;  // 감지 범위
    
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Attack")
    class USphereComponent* AttackSphere;     // 공격 범위
    
    bool bPlayerInDetectionRange = false;
    bool bPlayerInAttackRange = false;
    
public:
    AEnemyEvent()
    {
        // 감지 범위 설정
        DetectionSphere = CreateDefaultSubobject<USphereComponent>(TEXT("DetectionSphere"));
        DetectionSphere->SetupAttachment(RootComponent);
        DetectionSphere->SetSphereRadius(1000.0f);  // 10미터
        DetectionSphere->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
        DetectionSphere->SetCollisionResponseToAllChannels(ECR_Ignore);
        DetectionSphere->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
        
        // 공격 범위 설정
        AttackSphere = CreateDefaultSubobject<USphereComponent>(TEXT("AttackSphere"));
        AttackSphere->SetupAttachment(RootComponent);
        AttackSphere->SetSphereRadius(200.0f);  // 2미터
        AttackSphere->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
        AttackSphere->SetCollisionResponseToAllChannels(ECR_Ignore);
        AttackSphere->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
    }
    
    void BeginPlay() override
    {
        Super::BeginPlay();
        
        // 감지 범위 이벤트 바인딩
        DetectionSphere->OnComponentBeginOverlap.AddDynamic(
            this, &AEnemyEvent::OnPlayerEnterDetectionRange);
        DetectionSphere->OnComponentEndOverlap.AddDynamic(
            this, &AEnemyEvent::OnPlayerExitDetectionRange);
        
        // 공격 범위 이벤트 바인딩
        AttackSphere->OnComponentBeginOverlap.AddDynamic(
            this, &AEnemyEvent::OnPlayerEnterAttackRange);
        AttackSphere->OnComponentEndOverlap.AddDynamic(
            this, &AEnemyEvent::OnPlayerExitAttackRange);
    }
    
    // 플레이어가 감지 범위에 들어올 때만 호출됨
    UFUNCTION()
    void OnPlayerEnterDetectionRange(UPrimitiveComponent* OverlappedComp, 
                                   AActor* OtherActor, ...)
    {
        if (APawn* Player = Cast<APawn>(OtherActor))
        {
            bPlayerInDetectionRange = true;
            StartTrackingPlayer(Player);
        }
    }
    
    UFUNCTION()
    void OnPlayerExitDetectionRange(UPrimitiveComponent* OverlappedComp, 
                                  AActor* OtherActor, ...)
    {
        if (APawn* Player = Cast<APawn>(OtherActor))
        {
            bPlayerInDetectionRange = false;
            StopTrackingPlayer();
        }
    }
    
    // 플레이어가 공격 범위에 들어올 때만 호출됨
    UFUNCTION()
    void OnPlayerEnterAttackRange(UPrimitiveComponent* OverlappedComp, 
                                AActor* OtherActor, ...)
    {
        if (APawn* Player = Cast<APawn>(OtherActor))
        {
            bPlayerInAttackRange = true;
            StartAttack();
        }
    }
    
    UFUNCTION()
    void OnPlayerExitAttackRange(UPrimitiveComponent* OverlappedComp, 
                               AActor* OtherActor, ...)
    {
        if (APawn* Player = Cast<APawn>(OtherActor))
        {
            bPlayerInAttackRange = false;
            StopAttack();
        }
    }
    
    void Tick(float DeltaTime) override
    {
        // 플레이어가 감지 범위에 있을 때만 Tick 실행
        if (!bPlayerInDetectionRange)
        {
            return;  // 플레이어가 없으면 아무것도 안 함
        }
        
        // 여기서는 추적과 관련된 로직만
        Super::Tick(DeltaTime);
        UpdateTracking(DeltaTime);
    }
};
```

- 델리게이트와 이벤트 디스패처

```
// 게임 모드에서 글로벌 이벤트 관리
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnWaveStarted, int32, WaveNumber);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPlayerHealthChanged, float, NewHealth);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnPlayerEnterArea, AActor*, Player, FString, AreaName);

class AMyGameMode : public AGameModeBase
{
public:
    // 블루프린트에서도 사용 가능한 이벤트들
    UPROPERTY(BlueprintAssignable, Category = "Game Events")
    FOnWaveStarted OnWaveStarted;
    
    UPROPERTY(BlueprintAssignable, Category = "Game Events")
    FOnPlayerHealthChanged OnPlayerHealthChanged;
    
    UPROPERTY(BlueprintAssignable, Category = "Game Events")
    FOnPlayerEnterArea OnPlayerEnterArea;
    
    void StartNewWave(int32 WaveNum)
    {
        CurrentWave = WaveNum;
        
        // 모든 구독자에게 알림 - 한 번에!
        OnWaveStarted.Broadcast(WaveNum);  
        
        UE_LOG(LogTemp, Log, TEXT("Wave %d started - broadcasting to all listeners"), 
               WaveNum);
    }
    
    void NotifyPlayerHealthChanged(float NewHealth)
    {
        OnPlayerHealthChanged.Broadcast(NewHealth);
    }
};

class AEnemy : public ACharacter
{
public:
    void BeginPlay() override
    {
        Super::BeginPlay();
        
        if (AMyGameMode* GM = Cast<AMyGameMode>(GetWorld()->GetAuthGameMode()))
        {
            GM->OnWaveStarted.AddDynamic(this, &AEnemy::OnWaveStart);          
            GM->OnPlayerHealthChanged.AddDynamic(this, &AEnemy::OnPlayerHealthChanged);
        }
    }
    
    // 웨이브가 시작될 때만 호출됨
    UFUNCTION()
    void OnWaveStart(int32 WaveNumber)
    {
        UE_LOG(LogTemp, Log, TEXT("%s: Wave %d started - activating AI"), 
               *GetName(), WaveNumber);
        
        SetActorTickEnabled(true);
        StartAI();
    }
    
    // 플레이어 체력이 변할 때만 호출됨
    UFUNCTION()
    void OnPlayerHealthChanged(float NewHealth)
    {
        if (NewHealth < 0.3f)
        {
            SetAggressive(true);
        }
    }
};
```


##### 원칙 4: 오브젝트 풀링

```
// 효율적인 오브젝트 풀
UCLASS()
class MYGAME_API AProjectilePool : public AActor
{
    GENERATED_BODY()
    
private:
    // 사용 가능한 발사체들 (비활성 상태)
    UPROPERTY()
    TArray<class AProjectile*> AvailableProjectiles;
    
    // 현재 사용 중인 발사체들 (활성 상태)
    UPROPERTY()
    TArray<class AProjectile*> ActiveProjectiles;
    
    // 풀 설정
    UPROPERTY(EditAnywhere, Category = "Pool Settings")
    int32 InitialPoolSize = 100;  // 시작할 때 미리 만들 개수
    
    UPROPERTY(EditAnywhere, Category = "Pool Settings")
    int32 MaxPoolSize = 500;      // 최대 풀 크기
    
    UPROPERTY(EditAnywhere, Category = "Pool Settings")
    TSubclassOf<AProjectile> ProjectileClass;  // 발사체 클래스
    
public:
    AProjectilePool()
    {
        PrimaryActorTick.bCanEverTick = false;  // 풀 자체는 Tick 필요 없음
    }
    
    void BeginPlay() override
    {
        Super::BeginPlay();
        
        // 게임 시작할 때 미리 발사체들 생성
        PreAllocateProjectiles();
    }
    
    void PreAllocateProjectiles()
    {
        if (!ProjectileClass)
        {
            return;
        }
        
        // 배열 크기 미리 예약 (재할당 방지)
        AvailableProjectiles.Reserve(InitialPoolSize);
        ActiveProjectiles.Reserve(InitialPoolSize);
        
        for (int32 i = 0; i < InitialPoolSize; ++i)
        {
            // 발사체 생성 (화면 밖 어딘가에)
            FVector HiddenLocation = FVector(0, 0, -10000);  // 땅 밑에 숨기기
            
            AProjectile* NewProjectile = GetWorld()->SpawnActor<AProjectile>(
                ProjectileClass, 
                HiddenLocation, 
                FRotator::ZeroRotator
            );
            
            if (NewProjectile)
            {
                // 비활성 상태로 설정
                NewProjectile->SetActorHiddenInGame(true);      // 화면에 안 보이게
                NewProjectile->SetActorEnableCollision(false);  // 충돌 끄기
                NewProjectile->SetActorTickEnabled(false);      // Tick 끄기
                
                // 사용 가능한 풀에 추가
                AvailableProjectiles.Add(NewProjectile);
            }
        }
    }
    
    // 발사체 대여하기
    AProjectile* GetProjectile()
    {
        AProjectile* Projectile = nullptr;
        
        if (AvailableProjectiles.Num() > 0)
        {
            // 사용 가능한 발사체가 있으면 재사용
            Projectile = AvailableProjectiles.Pop();
            ActiveProjectiles.Add(Projectile);
            
            // 활성화
            Projectile->SetActorHiddenInGame(false);      // 보이게 하기
            Projectile->SetActorEnableCollision(true);    // 충돌 켜기
            Projectile->SetActorTickEnabled(true);        // Tick 켜기
            
            // 발사체 초기화 (이전 상태 제거)
            Projectile->Reset();
        }
        else if (ActiveProjectiles.Num() + AvailableProjectiles.Num() < MaxPoolSize)
        {
            // 풀이 비었지만 최대 크기에 도달하지 않았으면 새로 생성
            Projectile = GetWorld()->SpawnActor<AProjectile>(ProjectileClass);
            if (Projectile)
            {
                ActiveProjectiles.Add(Projectile);
            }
        }
        else
        {
            // 풀이 완전히 가득 참 - 가장 오래된 발사체 재사용
            UE_LOG(LogTemp, Warning, TEXT("Pool at maximum capacity! Recycling oldest projectile"));
            
            if (ActiveProjectiles.Num() > 0)
            {
                Projectile = ActiveProjectiles[0];  // 가장 오래된 것
                ActiveProjectiles.RemoveAt(0);
                ActiveProjectiles.Add(Projectile);  // 맨 뒤로 이동
                
                // 강제로 초기화
                Projectile->Reset();
            }
        }
        
        return Projectile;
    }
    
    // 발사체 반납하기
    void ReturnProjectile(AProjectile* Projectile)
    {
        if (!Projectile) return;
        
        // 활성 목록에서 제거
        int32 RemovedCount = ActiveProjectiles.RemoveSingle(Projectile);
        
        if (RemovedCount > 0)
        {
            // 비활성화
            Projectile->SetActorHiddenInGame(true);       // 숨기기
            Projectile->SetActorEnableCollision(false);   // 충돌 끄기
            Projectile->SetActorTickEnabled(false);       // Tick 끄기
            
            // 위치 초기화 (메모리 절약)
            Projectile->SetActorLocation(FVector(0, 0, -10000));
            Projectile->SetActorRotation(FRotator::ZeroRotator);
            
            // 사용 가능한 풀에 다시 추가
            AvailableProjectiles.Add(Projectile);
        }
    }
    
    // 현재 풀 상태 확인
    void LogPoolStatus() const
    {
        UE_LOG(LogTemp, Log, TEXT("Pool Status - Available: %d, Active: %d, Total: %d"), 
               AvailableProjectiles.Num(), 
               ActiveProjectiles.Num(),
               AvailableProjectiles.Num() + ActiveProjectiles.Num());
    }
    
    // 게임 끝날 때 정리
    void EndPlay(const EEndPlayReason::Type EndPlayReason) override
    {
        // 모든 발사체 파괴 (언리얼이 자동으로 해주지만 명시적으로)
        for (AProjectile* Projectile : AvailableProjectiles)
        {
            if (Projectile)
            {
                Projectile->Destroy();
            }
        }
        
        for (AProjectile* Projectile : ActiveProjectiles)
        {
            if (Projectile)
            {
                Projectile->Destroy();
            }
        }
        
        AvailableProjectiles.Empty();
        ActiveProjectiles.Empty();
        
        Super::EndPlay(EndPlayReason);
    }
};
```

- 발사체 클래스도 풀링에 맞게 수정

```
// 풀링을 고려한 발사체 클래스
class AProjectile : public AActor
{
private:
    UPROPERTY()
    class AProjectilePool* OwnerPool;  // 자신이 속한 풀

    float LifeTime = 5.0f;             // 생존 시간
    float ElapsedTime = 0.0f;          // 경과 시간

public:
    void SetOwnerPool(AProjectilePool* Pool) { OwnerPool = Pool; }

    // 풀에서 대여될 때 초기화
    void Reset()
    {
        ElapsedTime = 0.0f;
        // 기타 초기화 작업...
    }

    void Tick(float DeltaTime) override
    {
        Super::Tick(DeltaTime);

        // 이동 로직
        AddActorWorldOffset(GetActorForwardVector() * Speed * DeltaTime);

        // 시간 체크
        ElapsedTime += DeltaTime;
        if (ElapsedTime >= LifeTime)
        {
            // 수명이 다하면 풀로 돌아가기
            ReturnToPool();
        }
    }

    // 충돌했을 때도 풀로 돌아가기
    void OnHit()
    {
        // 히트 이펙트 등...
        ReturnToPool();
    }

private:
    void ReturnToPool()
    {
        if (OwnerPool)
        {
            OwnerPool->ReturnProjectile(this);
        }
        else
        {
            // 풀이 없으면 그냥 파괴
            Destroy();
        }
    }
};

```

- 사용법

```
// 무기에서 총알 발사
void AWeapon::Fire()
{
    if (ProjectilePool)
    {
        // 풀에서 발사체 가져오기 - new/delete 없음!
        AProjectile* Bullet = ProjectilePool->GetProjectile();

        if (Bullet)
        {
            // 발사 위치와 방향 설정
            Bullet->SetActorLocation(GetMuzzleLocation());
            Bullet->SetActorRotation(GetMuzzleRotation());
            Bullet->SetOwnerPool(ProjectilePool);

            // 발사!
            Bullet->Fire();
        }
    }
}
```


#### Tick 병합과 매니저 패턴

##### 개별 액터 방식의 문제점

```
// 개별 액터 방식 (X)
void AEnemy::Tick(float DeltaTime)
{
    FVector NewLocation = GetActorLocation() + Velocity * DeltaTime;
    SetActorLocation(NewLocation);
    
    Health -= PoisonDamage * DeltaTime;
}
```

- 함수 호출 오버헤드
	- 가상 함수 테이블 조회
	- 스택 프레임 생성
	- 매개변수 전달
	- 실제 함수 실행
	- 리턴값 처리

```
void TestPerformance()
{
    const int32 EntityCount = 1000;  // 1000개의 엔티티

    // 방법 1: 개별 Tick 방식 - 전통적인 객체지향 방식
    {
        // 테스트용 데이터 준비
        TArray<FVector> Locations;
        TArray<FVector> Velocities;
        TArray<float> Healths;
        TArray<float> PoisonDamages;

        // 데이터 초기화
        Locations.Reserve(EntityCount);
        Velocities.Reserve(EntityCount);
        Healths.Reserve(EntityCount);
        PoisonDamages.Reserve(EntityCount);

        for (int32 i = 0; i < EntityCount; ++i)
        {
            Locations.Add(FVector(i * 100.0f, i * 100.0f, 0.0f));  // 100cm 간격으로 배치
            Velocities.Add(FVector(100.0f, 0.0f, 0.0f));           // 초당 1미터 이동
            Healths.Add(100.0f);                                   // 체력 100
            PoisonDamages.Add(1.0f);                               // 초당 1의 독 데미지
        }

        // 이제 실제 성능 측정 시작
        float StartTime = FPlatformTime::Seconds();

        // 1000번의 개별 함수 호출 - 이게 바로 문제의 원인
        for (int32 i = 0; i < EntityCount; ++i)
        {
            UpdateEntity(Locations[i], Velocities[i], Healths[i], PoisonDamages[i], 0.016f);
        }

        float EndTime = FPlatformTime::Seconds();
        float IndividualTime = (EndTime - StartTime) * 1000.0f;

        UE_LOG(LogTemp, Log, TEXT("Individual calls: %.3f ms"), IndividualTime);
    }

    // 방법 2: 일괄 처리 방식 - 데이터 지향 접근법
    {
        // 같은 데이터로 다시 초기화
        TArray<FVector> Locations;
        TArray<FVector> Velocities;
        TArray<float> Healths;
        TArray<float> PoisonDamages;

        // 동일한 데이터 준비
        Locations.Reserve(EntityCount);
        Velocities.Reserve(EntityCount);
        Healths.Reserve(EntityCount);
        PoisonDamages.Reserve(EntityCount);

        for (int32 i = 0; i < EntityCount; ++i)
        {
            Locations.Add(FVector(i * 100.0f, i * 100.0f, 0.0f));
            Velocities.Add(FVector(100.0f, 0.0f, 0.0f));
            Healths.Add(100.0f);
            PoisonDamages.Add(1.0f);
        }

        float StartTime = FPlatformTime::Seconds();

        // 단 1번의 함수 호출로 1000개 모두 처리
        UpdateEntitiesBatch(Locations, Velocities, Healths, PoisonDamages, 0.016f);

        float EndTime = FPlatformTime::Seconds();
        float BatchTime = (EndTime - StartTime) * 1000.0f;

        UE_LOG(LogTemp, Log, TEXT("Batch processing: %.3f ms"), BatchTime);
        UE_LOG(LogTemp, Log, TEXT("Speedup: %.1fx"), IndividualTime / BatchTime);
    }
}

// 개별 처리용 함수 - 전통적인 방식
void UpdateEntity(FVector& Location, const FVector& Velocity, float& Health, float PoisonDamage, float DeltaTime)
{
    // 위치 업데이트 - 물리학 공식: 새 위치 = 현재 위치 + 속도 * 시간
    Location += Velocity * DeltaTime;

    // 체력 감소 - 독 데미지 적용
    Health -= PoisonDamage * DeltaTime;
}

// 일괄 처리용 함수 - 데이터 지향 방식
void UpdateEntitiesBatch(TArray<FVector>& Locations, const TArray<FVector>& Velocities,
                        TArray<float>& Healths, const TArray<float>& PoisonDamages, float DeltaTime)
{
    const int32 Count = Locations.Num();

    // 첫 번째 루프: 모든 위치를 한 번에 업데이트
    for (int32 i = 0; i < Count; ++i)
    {
        Locations[i] += Velocities[i] * DeltaTime;
    }

    // 두 번째 루프: 모든 체력을 한 번에 업데이트
    for (int32 i = 0; i < Count; ++i)
    {
        Healths[i] -= PoisonDamages[i] * DeltaTime;
    }
}
```


##### 매니저 시스템 구현

- 전통적인 AoS (Array of Structures) 방식

```
// 이렇게 하나의 구조체에 모든 데이터를 넣는 방식
struct FProjectile
{
    FVector Position;    // 12 bytes
    FVector Velocity;    // 12 bytes
    float Lifetime;      // 4 bytes
    float Damage;        // 4 bytes
    AActor* Target;      // 8 bytes (포인터)
    bool bActive;        // 1 byte + 3 bytes padding
    int32 TeamID;        // 4 bytes
};
// 총 48 bytes per projectile

TArray<FProjectile> Projectiles;  // 이렇게 저장
```

- 혁신적인 SoA (Structure of Arrays) 방식

```
// 같은 종류의 데이터끼리 따로 저장하는 방식
class UProjectileManager
{
private:
    TArray<FVector> Positions;    // 모든 발사체의 위치만 모아서
    TArray<FVector> Velocities;   // 모든 발사체의 속도만 모아서
    TArray<float> Lifetimes;      // 모든 발사체의 생존시간만 모아서
    TArray<float> Damages;        // 모든 발사체의 데미지만 모아서
    TArray<AActor*> Targets;      // 모든 발사체의 타겟만 모아서
    TArray<bool> ActiveFlags;     // 모든 발사체의 활성상태만 모아서
    TArray<int32> TeamIDs;        // 모든 발사체의 팀ID만 모아서
};
```

- 완전한 발사체 매니저 구현

```
// 고성능 발사체 매니저 (SoA 구조 + 메모리 재사용)
UCLASS()
class MYGAME_API UProjectileManagerSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()
    
private:
    // SoA (Structure of Arrays) 구조
    TArray<FVector> Positions;
    TArray<FVector> Velocities;
    TArray<float> Lifetimes;
    TArray<float> Damages;
    TArray<AActor*> Targets;
    TArray<bool> ActiveFlags;
    TArray<int32> TeamIDs;
    
    // 재사용 가능한 인덱스 (슬롯 풀)
    TArray<int32> FreeIndices;
    
    int32 MaxCapacity = 2000;  // 최대 발사체 수
    
    float LastUpdateTime = 0.0f;
    int32 ActiveProjectileCount = 0;
    
public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override
    {
        Super::Initialize(Collection);
        
        // 메모리 미리 예약 → 재할당 방지
        Positions.Reserve(MaxCapacity);
        Velocities.Reserve(MaxCapacity);
        Lifetimes.Reserve(MaxCapacity);
        Damages.Reserve(MaxCapacity);
        Targets.Reserve(MaxCapacity);
        ActiveFlags.Reserve(MaxCapacity);
        TeamIDs.Reserve(MaxCapacity);
        FreeIndices.Reserve(MaxCapacity);
        
        // 1초마다 성능 통계 출력
        FTimerHandle TimerHandle;
        GetWorld()->GetTimerManager().SetTimer(TimerHandle, [this]()
        {
            LogPerformanceStats();
        }, 1.0f, true);
    }
    
    // 새로운 발사체 등록
    int32 RegisterProjectile(const FVector& Position, const FVector& Velocity, 
                            float Damage, AActor* Target = nullptr, int32 TeamID = 0)
    {
        int32 Index;
        
        if (FreeIndices.Num() > 0)
        {
            // 삭제된 슬롯 재사용
            Index = FreeIndices.Pop();
        }
        else
        {
            Index = Positions.Num();
            
            if (Index >= MaxCapacity)
            {
                // 초과 시 거부
                return INDEX_NONE;
            }
            
            // AddUninitialized → 생성자 호출 생략 (빠름)
            Positions.AddUninitialized();
            Velocities.AddUninitialized();
            Lifetimes.AddUninitialized();
            Damages.AddUninitialized();
            Targets.AddDefaulted();
            ActiveFlags.Add(false);
            TeamIDs.AddUninitialized();
        }
        
        // 발사체 데이터 설정
        Positions[Index] = Position;
        Velocities[Index] = Velocity;
        Lifetimes[Index] = 5.0f; // 기본 생존 시간
        Damages[Index] = Damage;
        Targets[Index] = Target;
        ActiveFlags[Index] = true;
        TeamIDs[Index] = TeamID;
        
        ActiveProjectileCount++;
        
        return Index;
    }
    
    // 발사체 제거
    void UnregisterProjectile(int32 Index)
    {
        if (!ActiveFlags.IsValidIndex(Index) || !ActiveFlags[Index])
        {
            return;
        }
        
        ActiveFlags[Index] = false;
        Targets[Index] = nullptr;
        
        // 인덱스 풀에 반납
        FreeIndices.Add(Index);
        
        ActiveProjectileCount--;
    }
    
    // 메인 업데이트
    virtual void Tick(float DeltaTime) override
    {
        TRACE_CPUPROFILER_EVENT_SCOPE(ProjectileManager_Tick);
        
        if (ActiveProjectileCount == 0)
        {
            return;
        }
        
        float StartTime = FPlatformTime::Seconds();
        const int32 Count = Positions.Num();
        
        // Phase 1: 이동
        {
            TRACE_CPUPROFILER_EVENT_SCOPE(ProjectileManager_Movement);
            
            for (int32 i = 0; i < Count; ++i)
            {
                if (!ActiveFlags[i]) continue;
                
                Positions[i] += Velocities[i] * DeltaTime;
                Lifetimes[i] -= DeltaTime;
            }
        }
        
        // Phase 2: 충돌 체크
        {
            TRACE_CPUPROFILER_EVENT_SCOPE(ProjectileManager_Collision);
            
            TArray<int32> ToRemove;
            ToRemove.Reserve(32);
            
            for (int32 i = 0; i < Count; ++i)
            {
                if (!ActiveFlags[i]) continue;
                
                AActor* HitActor = CheckCollision(Positions[i], 50.0f, TeamIDs[i]);
                if (HitActor)
                {
                    ApplyDamage(HitActor, Damages[i]);
                    ToRemove.Add(i);
                }
            }
            
            for (int32 Index : ToRemove)
            {
                UnregisterProjectile(Index);
            }
        }
        
        // Phase 3: 수명 만료
        {
            TRACE_CPUPROFILER_EVENT_SCOPE(ProjectileManager_Lifetime);
            
            TArray<int32> ToRemove;
            ToRemove.Reserve(16);
            
            for (int32 i = 0; i < Count; ++i)
            {
                if (!ActiveFlags[i]) continue;
                
                if (Lifetimes[i] <= 0.0f)
                {
                    ToRemove.Add(i);
                }
            }
            
            for (int32 Index : ToRemove)
            {
                UnregisterProjectile(Index);
            }
        }
        
        LastUpdateTime = (FPlatformTime::Seconds() - StartTime) * 1000.0f;
    }
    
    // 단순 구체 충돌
    AActor* CheckCollision(const FVector& Position, float Radius, int32 ProjectileTeam)
    {
        UWorld* World = GetWorld();
        if (!World) return nullptr;
        
        FCollisionQueryParams QueryParams;
        QueryParams.bTraceComplex = false;
        QueryParams.bReturnPhysicalMaterial = false;
        
        FHitResult HitResult;
        bool bHit = World->SweepSingleByChannel(
            HitResult,
            Position,
            Position,
            FQuat::Identity,
            ECC_Pawn,
            FCollisionShape::MakeSphere(Radius),
            QueryParams
        );
        
        if (bHit && HitResult.GetActor())
        {
            if (GetActorTeam(HitResult.GetActor()) != ProjectileTeam)
            {
                return HitResult.GetActor();
            }
        }
        
        return nullptr;
    }
    
    // 데미지 적용
    void ApplyDamage(AActor* Target, float Damage)
    {
        if (!Target) return;
        
        UGameplayStatics::ApplyPointDamage(
            Target,
            Damage,
            Target->GetActorLocation(),
            FHitResult(),
            nullptr,
            this,
            UDamageType::StaticClass()
        );
    }
    
    int32 GetActorTeam(AActor* Actor)
    {
        return 0;
    }
};
```


##### TickGruop과 실행 순서 제어

- 언리얼의 TickGroup 시스템

```
// TickGroup 종류 (실행 순서대로)
enum ETickingGroup : uint8
{
    TG_PrePhysics,        // 물리 시뮬레이션 전
    TG_StartPhysics,      // 물리 시뮬레이션 시작
    TG_DuringPhysics,     // 물리 시뮬레이션 중
    TG_EndPhysics,        // 물리 시뮬레이션 끝
    TG_PostPhysics,       // 물리 시뮬레이션 후
    TG_PostUpdateWork,    // 업데이트 작업 후
    TG_LastDemotable,     // 마지막
    TG_NewlySpawned       // 새로 생성된 액터들
};
```

- 매니저에 적절한 TickGroup 설정하기

```
// 매니저에 적절한 TickGroup 설정
class AProjectileManager : public AActor
{
public:
    AProjectileManager()
    {
        PrimaryActorTick.TickGroup = TG_PrePhysics;  // 물리 시뮬레이션 전에 실행
        PrimaryActorTick.bHighPriority = true;       // 높은 우선순위
        PrimaryActorTick.bCanEverTick = true;
        PrimaryActorTick.bStartWithTickEnabled = true;
    }
};

class APhysicsManager : public AActor  
{
public:
    APhysicsManager()
    {
        // 물리 시뮬레이션 후에 실행 (물리 결과 처리)
        PrimaryActorTick.TickGroup = TG_PostPhysics;
    }
};

class ARenderingManager : public AActor
{
public:
    ARenderingManager()
    {
        // 모든 업데이트 작업 후에 실행 (렌더링 준비)
        PrimaryActorTick.TickGroup = TG_PostUpdateWork;
    }
};
```

- Tick 의존성 직접 설정하기

```
// 특정 액터가 끝난 후에 실행되도록 설정
void AMyActor::BeginPlay()
{
    Super::BeginPlay();

    // ProjectileManager의 Tick이 끝난 후에 이 액터의 Tick 실행
    if (AProjectileManager* ProjMgr = FindProjectileManager())
    {
        // AddPrerequisite: "이 액터가 끝나면 내가 실행되게 해줘"
        PrimaryActorTick.AddPrerequisite(ProjMgr, ProjMgr->PrimaryActorTick);
    }
}

AProjectileManager* AMyActor::FindProjectileManager()
{
    // 월드에서 ProjectileManager 찾기
    UWorld* World = GetWorld();
    if (!World) return nullptr;

    // TActorIterator: 특정 타입의 액터를 찾는 언리얼의 편리한 도구
    for (TActorIterator<AProjectileManager> ActorItr(World); ActorItr; ++ActorItr)
    {
        return *ActorItr;  // 첫 번째 발견된 매니저 반환
    }

    return nullptr;
}
```


#### 메모리와 컨테이너 최적화

##### TArray의 올바른 사용법

- 가장 흔한 실수

```
// 성능 킬러 - 계속 재할당이 일어나는 코드
void BadExample()
{
	TArray<FVector> Points;  // 빈 배열로 시작 - 초기 용량은 0
	
		// 10000개의 점을 추가하는 반복문
	for (int32 i = 0; i < 10000; ++i)
	{
			FVector NewPoint = FVector(i, i, i);  // 새로운 벡터 생성
			Points.Add(NewPoint);  // 배열에 추가 - 여기서 문제 발생!
	}
}
```

```
// 성능 최적화 - 미리 공간을 확보하는 올바른 방법
void GoodExample()
{
    TArray<FVector> Points;
    
    // 핵심! 미리 10000개 공간을 확보
    Points.Reserve(10000); // 중요
    
    // 이제 재할당 없이 빠르게 추가 가능!
    for (int32 i = 0; i < 10000; ++i)
    {
        FVector NewPoint = FVector(i, i, i);
        Points.Add(NewPoint);  // 재할당 없음 = 매우 빠름
    }
}
```

- 성능 차이 측정을 위한 예제

```
void CompareArrayPerformance()
{
    const int32 ElementCount = 50000;  // 5만개로 테스트
    
    // 방법 1: Reserve 없이 (나쁜 방법)
    {
        // 시간 측정 시작
        double StartTime = FPlatformTime::Seconds();
        
        TArray<FVector> TestArray;  // 빈 배열로 시작
        for (int32 i = 0; i < ElementCount; ++i)
        {
            // 매번 Add() 호출 - 재할당 위험
            TestArray.Add(FVector(i, i, i));
        }
        
        // 시간 측정 끝
        double EndTime = FPlatformTime::Seconds();
        double TimeWithoutReserve = (EndTime - StartTime) * 1000.0;
        
        UE_LOG(LogTemp, Log, TEXT("Reserve 없이: %.3f ms"), TimeWithoutReserve);
    }
    
    // 방법 2: Reserve 사용 (좋은 방법)
    {
        // 시간 측정 시작
        double StartTime = FPlatformTime::Seconds();
        
        TArray<FVector> TestArray;
        TestArray.Reserve(ElementCount);  // 핵심! 미리 공간 확보
        for (int32 i = 0; i < ElementCount; ++i)
        {
            // 이제 재할당 없이 빠르게 추가
            TestArray.Add(FVector(i, i, i));
        }
        
        // 시간 측정 끝
        double EndTime = FPlatformTime::Seconds();
        double TimeWithReserve = (EndTime - StartTime) * 1000.0;
        
        UE_LOG(LogTemp, Log, TEXT("Reserve 사용: %.3f ms"), TimeWithReserve);
        UE_LOG(LogTemp, Log, TEXT("성능 향상: %.1f배"), TimeWithoutReserve / TimeWithReserve);
    }
}
```

- 다양한 TArray 최적화 기법

```
class FArrayOptimizationTips
{
public:
    void ShowAddUninitializedBenefit()
    {
        const int32 Count = 10000;

        // 방법 1: 일반 Add (생성자 호출)
        TArray<FVector> Vectors1;
        Vectors1.Reserve(Count);
        for (int32 i = 0; i < Count; ++i)
        {
            Vectors1.Add(FVector::ZeroVector);  // FVector 생성자 호출
        }

        // 방법 2: AddUninitialized (생성자 호출 안 함)
        TArray<FVector> Vectors2;
        Vectors2.Reserve(Count);
        for (int32 i = 0; i < Count; ++i)
        {
            int32 Index = Vectors2.AddUninitialized();  // 생성자 호출 안 함
            Vectors2[Index] = FVector::ZeroVector;      // 직접 할당
        }
    }

    void ShowSetNumUsage()
    {
        TArray<int32> Numbers;

        // 기본 SetNum - 새 요소는 0으로 초기화
        Numbers.SetNum(100);

        // SetNumUninitialized - 초기화 없이 크기만 설정 (더 빠름)
        Numbers.SetNumUninitialized(200);

        // 크기 줄이기 + 메모리 축소
        Numbers.SetNum(50, true);  // bAllowShrinking = true
    }

    void ShowEmplaceBenefit()
    {
        struct FComplexStruct
        {
            FString Name;
            TArray<int32> Values;

            FComplexStruct(const FString& InName, int32 ValueCount)
                : Name(InName)
            {
                Values.Reserve(ValueCount);
                for (int32 i = 0; i < ValueCount; ++i)
                {
                    Values.Add(i);
                }
            }
        };

        const int32 Count = 1000;

        // 방법 1: Add (불필요한 복사)
        TArray<FComplexStruct> Array1;
        Array1.Reserve(Count);
        for (int32 i = 0; i < Count; ++i)
        {
            FComplexStruct Temp(FString::Printf(TEXT("Item%d"), i), 10);
            Array1.Add(Temp);  // 복사 생성자 호출!
        }

        // 방법 2: Emplace (제자리 생성)
        TArray<FComplexStruct> Array2;
        Array2.Reserve(Count);
        for (int32 i = 0; i < Count; ++i)
        {
            Array2.Emplace(FString::Printf(TEXT("Item%d"), i), 10);  // 바로 생성!
        }
    }

    void ShowInlineAllocator()
    {
        // 일반 TArray
        TArray<int32> NormalArray;

        // 인라인 할당자 (스택에 8개까지)
        TArray<int32, TInlineAllocator<8>> InlineArray;

        // 8개까지는 스택 사용 (매우 빠름)
        for (int32 i = 0; i < 8; ++i)
        {
            InlineArray.Add(i);  // 스택 메모리 사용
        }

        InlineArray.Add(8);  // 9번째부터는 힙 사용

        // 실제 사용 예시
        struct FPlayerAction
        {
            TArray<AActor*, TInlineAllocator<8>> Targets;  // 대부분 1-3개, 최대 8개

            void AddTarget(AActor* Target)
            {
                if (Targets.Num() < 8)
                {
                    Targets.Add(Target);  // 스택 메모리 사용
                }
            }
        };
    }

    void ShowMoveSemantics()
    {
        TArray<FString> Strings;
        FString LongString = TEXT("This is a very long string...");

        // 방법 1: 복사 (느림)
        Strings.Add(LongString);  // 문자열 복사

        // 방법 2: 이동 (빠름)
        FString AnotherLongString = TEXT("Another very long string...");
        Strings.Add(MoveTemp(AnotherLongString));  // 내부 버퍼 이동
    }
};
```


##### TMap vs TArray 성능 비교

- 사용 가이드라인

```
// TMap을 써야 하는 경우
class FPlayerDatabase
{
private:
    TMap<int32, FPlayerData> Players;  // PlayerID -> PlayerData

public:
    FPlayerData* FindPlayer(int32 PlayerID)
    {
        return Players.Find(PlayerID);  // O(1) 조회
    }

    void AddPlayer(int32 PlayerID, const FPlayerData& Data)
    {
        Players.Add(PlayerID, Data);
    }

    void RemovePlayer(int32 PlayerID)
    {
        Players.Remove(PlayerID);
    }
};

// TArray를 써야 하는 경우
class FUnitManager
{
private:
    TArray<FUnitData> Units;  // 인덱스가 Unit ID

public:
    FUnitData& GetUnit(int32 UnitID)
    {
        return Units[UnitID];  // O(1) 인덱스 접근
    }

    void UpdateAllUnits(float DeltaTime)
    {
        for (FUnitData& Unit : Units)  // 캐시 친화적
        {
            Unit.Update(DeltaTime);
        }
    }
};

// 하이브리드 접근법 - 정렬된 배열
class FSortedDatabase
{
private:
    TArray<FDatabaseEntry> Entries;  // ID로 정렬된 배열

public:
    struct FDatabaseEntry
    {
        int32 ID;
        FString Name;
        float Value;

        bool operator<(const FDatabaseEntry& Other) const
        {
            return ID < Other.ID;
        }
    };

    FDatabaseEntry* Find(int32 ID)
    {
        // 이진 탐색
        int32 Index = Algo::BinarySearchBy(Entries, ID,
            [](const FDatabaseEntry& Entry) { return Entry.ID; });

        return Index != INDEX_NONE ? &Entries[Index] : nullptr;
    }

    void Add(const FDatabaseEntry& NewEntry)
    {
        int32 InsertIndex = Algo::LowerBoundBy(Entries, NewEntry.ID,
            [](const FDatabaseEntry& Entry) { return Entry.ID; });

        Entries.Insert(NewEntry, InsertIndex);
    }
};
```

- 하이브리드 접근법 - 정렬된 배열

```
// 검색도 필요하고 메모리도 절약하고 싶을 때
class FSortedDatabase
{
private:
    // ID로 정렬된 배열 - 메모리 효율성과 검색 성능의 절충점
    TArray<FDatabaseEntry> Entries;
    
public:
    struct FDatabaseEntry
    {
        int32 ID;
        FString Name;
        float Value;
        
        // 정렬을 위한 비교 연산자
        bool operator<(const FDatabaseEntry& Other) const
        {
            return ID < Other.ID;  // ID 기준 오름차순 정렬
        }
    };
    
    // 이진 탐색으로 빠른 검색
    // TMap보다는 느리지만 (O(log N)), TArray 순차탐색보다는 빠름
    FDatabaseEntry* Find(int32 ID)
    {
        // 언리얼 엔진의 이진 탐색 함수 사용
        // 정렬된 배열에서 O(log N) 시간에 검색
        int32 Index = Algo::BinarySearchBy(Entries, ID, 
            [](const FDatabaseEntry& Entry) { return Entry.ID; });
        
        // INDEX_NONE이면 찾지 못한 것
        return Index != INDEX_NONE ? &Entries[Index] : nullptr;
    }
    
    // 정렬 순서를 유지하면서 삽입
    void Add(const FDatabaseEntry& NewEntry)
    {
        // 삽입할 위치를 이진 탐색으로 찾기
        // LowerBound: NewEntry.ID 이상인 첫 번째 위치
        int32 InsertIndex = Algo::LowerBoundBy(Entries, NewEntry.ID,
            [](const FDatabaseEntry& Entry) { return Entry.ID; });
        
        // 찾은 위치에 삽입하여 정렬 순서 유지
        Entries.Insert(NewEntry, InsertIndex);
        
        UE_LOG(LogTemp, Log, TEXT("ID %d를 인덱스 %d에 삽입"), NewEntry.ID, InsertIndex);
    }
    
    // 순차 접근은 TArray와 동일하게 빠름
    void ProcessAll()
    {
        // 메모리가 연속되어 있어 캐시 효율성 높음
        for (const FDatabaseEntry& Entry : Entries)
        {
            ProcessEntry(Entry);  // 각 엔트리 처리
        }
    }
    
    // 통계 정보 출력
    void LogStatistics() const
    {
        UE_LOG(LogTemp, Log, TEXT("=== 데이터베이스 통계 ==="));
        UE_LOG(LogTemp, Log, TEXT("총 엔트리 수: %d"), Entries.Num());
        UE_LOG(LogTemp, Log, TEXT("메모리 사용량: %.2f KB"), 
               Entries.GetAllocatedSize() / 1024.0f);
        UE_LOG(LogTemp, Log, TEXT("검색 시간복잡도: O(log N) = O(log %d)"), Entries.Num());  
    }
    
private:
    void ProcessEntry(const FDatabaseEntry& Entry)
    {
        // 실제 엔트리 처리 로직
        UE_LOG(LogTemp, VeryVerbose, TEXT("Processing Entry ID: %d, Name: %s"), 
               Entry.ID, *Entry.Name);
    }
};
```


#### 케이스 스터디 : 좀비 서바이벌 게임 최적화

##### 초기 상황 - 성능 재앙

```
// 초기 버전 - 성능 재앙
class AZombie : public ACharacter
{
public:
    AZombie()
    {
        PrimaryActorTick.bCanEverTick = true;  // 모든 좀비가 Tick!
    }
    
    void Tick(float DeltaTime) override
    {
        Super::Tick(DeltaTime);
        
        // 매 프레임 플레이어 찾기!
        APawn* Player = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
        if (Player)
        {
            float Distance = GetDistanceTo(Player);  // 제곱근 계산!
            
            if (Distance < 1000.0f)  // 10미터
            {
                // 플레이어 추적
                FVector Direction = (Player->GetActorLocation() - GetActorLocation()).GetSafeNormal();
                SetActorLocation(GetActorLocation() + Direction * 200.0f * DeltaTime);
            }
        }
        
        // 체력 관리
        if (Health <= 0)
        {
            Destroy();  // 매 프레임 체크!
        }
    }
    
private:
    float Health = 100.0f;
};
```


##### 1단계 최적화 - 매니저 패턴 도입

```
// 1단계 - 매니저로 일괄 처리
UCLASS()
class AZombieManager : public AActor
{
    GENERATED_BODY()
    
private:
    // SoA 구조로 데이터 저장
    TArray<FVector> ZombiePositions;      // 좀비 위치들
    TArray<FVector> ZombieVelocities;     // 좀비 속도들
    TArray<float> ZombieHealths;          // 좀비 체력들
    TArray<EZombieState> ZombieStates;    // 좀비 상태들
    TArray<float> ZombieAttackTimers;     // 공격 타이머들
    TArray<AZombie*> ZombieActors;        // 실제 액터 참조
    
    // 공간 분할용 그리드
    TMap<FIntPoint, TArray<int32>> SpatialGrid;
    float GridCellSize = 500.0f;  // 5미터 셀
    
    // 성능 통계
    float LastUpdateTime = 0.0f;
    int32 ActiveZombieCount = 0;
    
public:
    AZombieManager()
    {
        PrimaryActorTick.bCanEverTick = true;
        PrimaryActorTick.TickGroup = TG_PrePhysics;  // 물리 전에 실행
    }
    
    void RegisterZombie(AZombie* Zombie)
    {
        if (!Zombie) return;
        
        int32 Index = ZombiePositions.Num();
        
        // 모든 배열에 데이터 추가
        ZombiePositions.Add(Zombie->GetActorLocation());
        ZombieVelocities.Add(FVector::ZeroVector);
        ZombieHealths.Add(100.0f);
        ZombieStates.Add(EZombieState::Idle);
        ZombieAttackTimers.Add(0.0f);
        ZombieActors.Add(Zombie);
        
        // 공간 그리드에 추가
        FIntPoint GridCell = GetGridCell(Zombie->GetActorLocation());
        SpatialGrid.FindOrAdd(GridCell).Add(Index);
        
        // 원본 좀비의 Tick 끄기 - 매니저가 대신 처리
        Zombie->SetActorTickEnabled(false);
        
        ActiveZombieCount++;
        
        UE_LOG(LogTemp, Log, TEXT("Registered zombie %d: %s"), Index, *Zombie->GetName());
    }
    
    void Tick(float DeltaTime) override
    {
        TRACE_CPUPROFILER_EVENT_SCOPE(ZombieManager_Tick);
        
        float StartTime = FPlatformTime::Seconds();
        
        // 단계별 업데이트
        UpdateMovement(DeltaTime);
        UpdateAI(DeltaTime);
        UpdateCombat(DeltaTime);
        UpdateSpatialGrid();
        
        LastUpdateTime = (FPlatformTime::Seconds() - StartTime) * 1000.0f;
        
        // 1초마다 성능 통계 출력
        static float StatTimer = 0.0f;
        StatTimer += DeltaTime;
        if (StatTimer >= 1.0f)
        {
            UE_LOG(LogTemp, Log, TEXT("ZombieManager: %d zombies, %.3fms update time"), 
                   ActiveZombieCount, LastUpdateTime);
            StatTimer = 0.0f;
        }
    }
    
private:
    void UpdateMovement(float DeltaTime)
    {
        TRACE_CPUPROFILER_EVENT_SCOPE(ZombieManager_Movement);
        
        APawn* Player = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
        if (!Player) return;
        
        FVector PlayerPos = Player->GetActorLocation();
        const int32 Count = ZombiePositions.Num();
        
        // 병렬 처리로 이동 계산
        ParallelFor(Count, [&](int32 Index)
        {
            if (ZombieStates[Index] == EZombieState::Chasing)
            {
                // 제곱 거리 사용 (제곱근 계산 안 함)
                float DistanceSquared = FVector::DistSquared(PlayerPos, ZombiePositions[Index]);
                
                if (DistanceSquared < 1000000.0f)  // 10m * 10m
                {
                    FVector Direction = (PlayerPos - ZombiePositions[Index]).GetSafeNormal();
                    ZombieVelocities[Index] = Direction * 200.0f;  // 2m/s
                    ZombiePositions[Index] += ZombieVelocities[Index] * DeltaTime;
                    
                    // 실제 액터 위치 업데이트
                    if (ZombieActors[Index])
                    {
                        ZombieActors[Index]->SetActorLocation(ZombiePositions[Index]);
                    }
                }
            }
        }, 50);  // 50개씩 배치 처리
    }
    
    void UpdateAI(float DeltaTime)
    {
        TRACE_CPUPROFILER_EVENT_SCOPE(ZombieManager_AI);
        
        // AI는 직렬 처리 (게임 상태 변경이 있으므로)
        const int32 Count = ZombiePositions.Num();
        
        for (int32 i = 0; i < Count; ++i)
        {
            if (ZombieHealths[i] <= 0) continue;  // 죽은 좀비 스킵
            
            // 간단한 상태 머신
            switch (ZombieStates[i])
            {
                case EZombieState::Idle:
                    // 플레이어 감지 체크 (가끔씩만)
                    if (FMath::RandRange(0.0f, 1.0f) < 0.1f)  // 10% 확률
                    {
                        if (IsPlayerNearby(i))
                        {
                            ZombieStates[i] = EZombieState::Chasing;
                        }
                    }
                    break;
                    
                case EZombieState::Chasing:
                    // 플레이어가 너무 멀면 포기
                    if (!IsPlayerNearby(i, 2000.0f))  // 20미터
                    {
                        ZombieStates[i] = EZombieState::Idle;
                        ZombieVelocities[i] = FVector::ZeroVector;
                    }
                    break;
            }
        }
    }
    
    void UpdateCombat(float DeltaTime)
    {
        TRACE_CPUPROFILER_EVENT_SCOPE(ZombieManager_Combat);
        
        APawn* Player = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
        if (!Player) return;
        
        FVector PlayerPos = Player->GetActorLocation();
        const float AttackRangeSquared = 150.0f * 150.0f;  // 1.5미터
        
        for (int32 i = 0; i < ZombiePositions.Num(); ++i)
        {
            if (ZombieHealths[i] <= 0) continue;
            
            // 공격 범위 체크
            float DistanceSquared = FVector::DistSquared(PlayerPos, ZombiePositions[i]);
            
            if (DistanceSquared < AttackRangeSquared)
            {
                // 공격 타이머 체크
                ZombieAttackTimers[i] -= DeltaTime;
                if (ZombieAttackTimers[i] <= 0.0f)
                {
                    // 플레이어 공격
                    UGameplayStatics::ApplyPointDamage(
                        Player,
                        10.0f,  // 데미지
                        ZombiePositions[i],
                        FHitResult(),
                        nullptr,
                        this,
                        UDamageType::StaticClass()
                    );
                    
                    ZombieAttackTimers[i] = 1.0f;  // 1초 쿨다운
                    
                    UE_LOG(LogTemp, Verbose, TEXT("Zombie %d attacked player"), i);
                }
            }
        }
    }
    
    void UpdateSpatialGrid()
    {
        TRACE_CPUPROFILER_EVENT_SCOPE(ZombieManager_SpatialGrid);
        
        // 일정 간격으로만 그리드 업데이트 (매 프레임 할 필요 없음)
        static float GridUpdateTimer = 0.0f;
        GridUpdateTimer += GetWorld()->GetDeltaSeconds();
        
        if (GridUpdateTimer >= 0.5f)  // 0.5초마다
        {
            SpatialGrid.Empty();  // 기존 그리드 정리
            
            for (int32 i = 0; i < ZombiePositions.Num(); ++i)
            {
                if (ZombieHealths[i] > 0)  // 살아있는 좀비만
                {
                    FIntPoint GridCell = GetGridCell(ZombiePositions[i]);
                    SpatialGrid.FindOrAdd(GridCell).Add(i);
                }
            }
            
            GridUpdateTimer = 0.0f;
        }
    }
    
    bool IsPlayerNearby(int32 ZombieIndex, float MaxDistance = 1000.0f)
    {
        APawn* Player = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
        if (!Player) return false;
        
        float DistanceSquared = FVector::DistSquared(
            Player->GetActorLocation(), 
            ZombiePositions[ZombieIndex]
        );
        
        return DistanceSquared < (MaxDistance * MaxDistance);
    }
    
    FIntPoint GetGridCell(const FVector& Position)
    {
        return FIntPoint(
            FMath::FloorToInt(Position.X / GridCellSize),
            FMath::FloorToInt(Position.Y / GridCellSize)
        );
    }
};
```


##### 2단계 최적화 - LOD 시스템 도입

```
// 2단계 - 거리 기반 LOD 시스템
void AZombieManager::UpdateAI_WithLOD(float DeltaTime)
{
    TRACE_CPUPROFILER_EVENT_SCOPE(ZombieManager_AI_LOD);
    
    APawn* Player = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
    if (!Player) return;
    
    FVector PlayerPos = Player->GetActorLocation();
    const int32 Count = ZombiePositions.Num();
    
    for (int32 i = 0; i < Count; ++i)
    {
        if (ZombieHealths[i] <= 0) continue;
        
        // 플레이어와의 거리에 따라 LOD 결정
        float DistanceSquared = FVector::DistSquared(PlayerPos, ZombiePositions[i]);
        
        if (DistanceSquared < 1000000.0f)  // 10m 이내 - 풀 업데이트
        {
            UpdateZombieAI_Full(i, DeltaTime);
        }
        else if (DistanceSquared < 9000000.0f)  // 30m 이내 - 간단 업데이트
        {
            UpdateZombieAI_Simple(i, DeltaTime);
        }
        else if (DistanceSquared < 25000000.0f)  // 50m 이내 - 최소 업데이트
        {
            UpdateZombieAI_Minimal(i, DeltaTime);
        }
        // 50m 밖은 업데이트 안 함
    }
}

void AZombieManager::UpdateZombieAI_Full(int32 Index, float DeltaTime)
{
    // 완전한 AI 처리
    // - 상태 머신 업데이트
    // - 세밀한 플레이어 추적
    // - 장애물 회피
    // - 소리 반응
    
    switch (ZombieStates[Index])
    {
        case EZombieState::Idle:
            // 플레이어 감지 (매 프레임)
            if (IsPlayerNearby(Index, 800.0f))
            {
                ZombieStates[Index] = EZombieState::Chasing;
                UE_LOG(LogTemp, Verbose, TEXT("Zombie %d started chasing"), Index);
            }
            break;
            
        case EZombieState::Chasing:
            // 정밀한 추적 로직
            UpdatePreciseChasing(Index, DeltaTime);
            break;
    }
}

void AZombieManager::UpdateZombieAI_Simple(int32 Index, float DeltaTime)
{
    // 간단한 AI 처리
    // - 기본 상태만 체크
    // - 단순한 이동
    
    if (ZombieStates[Index] == EZombieState::Chasing)
    {
        // 플레이어가 너무 멀면 포기
        if (!IsPlayerNearby(Index, 1500.0f))
        {
            ZombieStates[Index] = EZombieState::Idle;
        }
    }
}

void AZombieManager::UpdateZombieAI_Minimal(int32 Index, float DeltaTime)
{
    // 최소한의 처리만
    // - 가끔씩만 체크
    
    static float MinimalUpdateTimer = 0.0f;
    MinimalUpdateTimer += DeltaTime;
    
    if (MinimalUpdateTimer >= 2.0f)  // 2초마다
    {
        // 기본 상태 체크만
        if (ZombieStates[Index] == EZombieState::Chasing)
        {
            ZombieStates[Index] = EZombieState::Idle;  // 강제로 멈춤
        }
        
        MinimalUpdateTimer = 0.0f;
    }
}
```


##### 3단계 최적화 - 고급 공간 분할

```
// 3단계 - QuadTree를 이용한 공간 분할
class FZombieQuadTree
{
private:
    struct FQuadNode
    {
        FBox2D Bounds;
        TArray<int32> ZombieIndices;  // 이 노드에 있는 좀비들
        TArray<TUniquePtr<FQuadNode>> Children;
        
        static constexpr int32 MaxZombiesPerNode = 10;
        static constexpr int32 MaxDepth = 6;
        
        bool IsLeaf() const { return Children.Num() == 0; }
        
        void Insert(int32 ZombieIndex, const FVector2D& Position, int32 Depth = 0)
        {
            if (!Bounds.IsInside(Position)) return;
            
            if (IsLeaf() && (ZombieIndices.Num() < MaxZombiesPerNode || Depth >= MaxDepth))
            {
                ZombieIndices.Add(ZombieIndex);
            }
            else
            {
                if (IsLeaf())
                {
                    Subdivide();
                }
                
                for (auto& Child : Children)
                {
                    Child->Insert(ZombieIndex, Position, Depth + 1);
                }
            }
        }
        
        void Query(const FBox2D& QueryBounds, TArray<int32>& Results)
        {
            if (!Bounds.Intersect(QueryBounds)) return;
            
            if (IsLeaf())
            {
                for (int32 ZombieIndex : ZombieIndices)
                {
                    Results.Add(ZombieIndex);
                }
            }
            else
            {
                for (auto& Child : Children)
                {
                    Child->Query(QueryBounds, Results);
                }
            }
        }
        
    private:
        void Subdivide()
        {
            FVector2D Center = Bounds.GetCenter();
            FVector2D HalfSize = Bounds.GetSize() * 0.5f;
            
            Children.Add(MakeUnique<FQuadNode>());  // Top-Left
            Children.Add(MakeUnique<FQuadNode>());  // Top-Right
            Children.Add(MakeUnique<FQuadNode>());  // Bottom-Left
            Children.Add(MakeUnique<FQuadNode>());  // Bottom-Right
            
            Children[0]->Bounds = FBox2D(Bounds.Min, Center);
            Children[1]->Bounds = FBox2D(FVector2D(Center.X, Bounds.Min.Y), FVector2D(Bounds.Max.X, Center.Y));
            Children[2]->Bounds = FBox2D(FVector2D(Bounds.Min.X, Center.Y), FVector2D(Center.X, Bounds.Max.Y));
            Children[3]->Bounds = FBox2D(Center, Bounds.Max);
            
            // 기존 좀비들을 자식 노드로 재분배
            for (int32 ZombieIndex : ZombieIndices)
            {
                for (auto& Child : Children)
                {
                    // 좀비 위치를 가져와서 적절한 자식에 넣기 (구현 필요)
                }
            }
            
            ZombieIndices.Empty();
        }
    };
    
    TUniquePtr<FQuadNode> Root;
    
public:
    void Initialize(const FBox2D& WorldBounds)
    {
        Root = MakeUnique<FQuadNode>();
        Root->Bounds = WorldBounds;
    }
    
    void Clear()
    {
        if (Root)
        {
            Root->Children.Empty();
            Root->ZombieIndices.Empty();
        }
    }
    
    void Insert(int32 ZombieIndex, const FVector& Position)
    {
        if (Root)
        {
            Root->Insert(ZombieIndex, FVector2D(Position.X, Position.Y));
        }
    }
    
    TArray<int32> QueryRange(const FVector& Center, float Radius)
    {
        TArray<int32> Results;
        
        if (Root)
        {
            FBox2D QueryBounds(
                FVector2D(Center.X - Radius, Center.Y - Radius),
                FVector2D(Center.X + Radius, Center.Y + Radius)
            );
            
            Root->Query(QueryBounds, Results);
        }
        
        return Results;
    }
};

// 매니저에서 QuadTree 사용
void AZombieManager::UpdateCombat_WithQuadTree(float DeltaTime)
{
    TRACE_CPUPROFILER_EVENT_SCOPE(ZombieManager_Combat_QuadTree);
    
    APawn* Player = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
    if (!Player) return;
    
    FVector PlayerPos = Player->GetActorLocation();
    
    // QuadTree에서 플레이어 근처의 좀비들만 찾기
    TArray<int32> NearbyZombies = ZombieQuadTree.QueryRange(PlayerPos, 500.0f);
    
    UE_LOG(LogTemp, VeryVerbose, TEXT("Combat check: %d nearby zombies (total: %d)"), 
           NearbyZombies.Num(), ZombiePositions.Num());
    
    // 근처 좀비들만 전투 체크
    for (int32 ZombieIndex : NearbyZombies)
    {
        if (ZombieHealths[ZombieIndex] <= 0) continue;
        
        float DistanceSquared = FVector::DistSquared(PlayerPos, ZombiePositions[ZombieIndex]);
        
        if (DistanceSquared < 22500.0f)  // 1.5m 공격 범위
        {
            ZombieAttackTimers[ZombieIndex] -= DeltaTime;
            if (ZombieAttackTimers[ZombieIndex] <= 0.0f)
            {
                // 공격 처리
                UGameplayStatics::ApplyPointDamage(Player, 10.0f, ZombiePositions[ZombieIndex], 
                                                 FHitResult(), nullptr, this, UDamageType::StaticClass());
                
                ZombieAttackTimers[ZombieIndex] = 1.0f;
            }
        }
    }
}
```
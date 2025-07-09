---
title: 클린코드
description: 클린코드를 써야하는 이유와 클린코드와 그렇지 못한 코드들의 예시
author: gemini
date: 2025-07-09 18:00:00 +09:00
categories: [Unreal]
tags: [객체지향]
math: true
mermaid: true
---

#### 기이한 이름(Mysterious Name)

- 코드를 명료하게 표현하는데 가장 크게 기여하는 것은 이름
- 함수, 변수, 클래스, 모듈 **이름만 보고도 무슨 일을 하는 지 알아야 함**
- **명확한 이름이 떠오르지 않는다면 설계가 잘못되었을 수 있다는 것을 명심**

- 나쁜 예시

```
// 이름만 보고는 이게 뭔지 알 수가 없다 
void DoIt(int x); 

// 의미가 전혀 안 드러나는 변수들 
float AAA; 
int WTF;
```

- 좋은 예시

```
// '무엇을 하기 위한 함수인지'가 분명하다 
void AttackEnemy(int DamageAmount); 

// 변수의 역할이 명확하다 
float CurrentHealth; 
int EnemyCount;
```


#### 중복 코드(Duplicated Code)

- **Don't Repeat Yourself (DRY)의 원칙**
- **복사-붙여넣기 개발은 결국 더 많은 시간을 소비하게 만들 뿐**
- 중복된 코드는 하나만 수정해도 되도록 모아놓아야 한다
- 비슷하지만 조금씩 다른 코드는 공통 부분을 먼저 정리하고 나서 분리하자

- 나쁜 예시

```
// 데미지 처리

void TakeDamage(float Amount)
{
    Health -= Amount;
    if (Health <= 0)
    {
        Die();
    }
}

// 보스 데미지 처리
void BossTakeDamage(float Amount)
{
    Health -= Amount;
    if (Health <= 0)
    {
        SummonMinions(); // 보스라서 특별히 미니언을 소환
        Die();
    }
}
```

- 좋은 예시

```
// 공통 부모 클래스에서 데미지 로직을 통일
class AMonsterBase : public AActor
{
protected:
    virtual void OnDeath() { /* 비워두거나, 기본 처리 */ }

public:
    void TakeDamage(float Amount)
    {
        Health -= Amount;
        if (Health <= 0)
        {
            OnDeath();
        }
    }
};

// 몬스터
class AFieldMonster : public AMonsterBase
{
protected:
    virtual void OnDeath() override
    {
        // 필드 몬스터 전용 사망 처리
    }
};

// 보스
class ABoss : public AMonsterBase
{
protected:
    virtual void OnDeath() override
    {
        SummonMinions();
        // 보스 전용 사망 처리
    }
};
```


#### 긴 함수(Long Function)

- **짧은 함수와 좋은 이름의 조합이 최고**
- 짧은 함수는 '무엇을 하는지'를 명확히 보여주어 코드를 쉽게 파악하게 해줌
- 함수를 짧게 만들어야 공유하기도 편하다
- **주석이 필요하다고 느껴지는 부분은 따로 함수로 빼고, 의도가 드러나는 이름을 붙이자**

- 나쁜 예시

```
void AMyCharacter::Tick(float DeltaTime)
{
    // 1. 이동 처리
    // 2. 점프 처리
    // 3. 공격 처리
    // 4. 버프/디버프 처리
    // 5. 체력 체크
    // 6. 애니메이션 업데이트
    // ...
    // ...
    // (500줄이 넘어가요!)
}
```

- 좋은 예시

```
void AMyCharacter::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    HandleMovement(DeltaTime);
    HandleJump();
    HandleAttack();
    UpdateAnimation();
}

void AMyCharacter::HandleMovement(float DeltaTime)
{
    // 이동 관련 로직만 심플하게!
}

void AMyCharacter::HandleJump()
{
    // 점프 관련 로직만 모아둠
}

void AMyCharacter::HandleAttack()
{
    // 공격 로직
}
```


#### 긴 매개변수 목록(Long Parameter List)

- **매개변수가 많으면 함수를 이해하고 쓰기가 너무 불편해짐**
- 필요한 정보만 간결하게 전달할 수 있도록 묶거나 축소하자
- 중복된 정보가 있는지 확인하고, 불필요한 인수는 제거하면 됨

- 나쁜 예시

```
void InitWeapon(FString Name, float Damage, float FireRate, int32 AmmoCount, float ReloadTime, USkeletalMesh* Mesh, USoundBase* Sound)
{
    // 와, 많다 ...
}

InitWeapon("AK47", 42.0f, 0.25f, 30, 2.5f, MeshAsset, FireSound);
```

- 좋은 예시

```
// 구조체로 묶자
struct FWeaponData
{
    FString Name;
    float Damage;
    float FireRate;
    int32 AmmoCount;
};

// 구조체로 또 묶자
struct FWeaponAssets
{
    USkeletalMesh* Mesh;
    USoundBase* Sound;
};

void InitWeapon(const FWeaponData& InData, const FWeaponAssets& InAssets)
{
    // 훨씬 깔끔!
}

// 이제 이렇게 호출해서 쓰면 됨
FWeaponData WeaponInfo = { "AK47", 42.0f, 0.25f, 30, 2.5f };
FWeaponAssets Assets = { MeshAsset, FireSound };
InitWeapon(WeaponInfo, Assets);
```


#### 전역 데이터(Global Data)

- **전역 데이터의 남용은 프로그램의 악취중 가장 독한 악취 중의 하나**
- 어디서든 접근 가능해 디버깅과 유지보수가 복잡해짐
- 값이 바뀔 때 추적이 어려워 에러가 숨어들기 쉬움
- 데이터 범위를 최소화하고, 꼭 필요한 곳에서만 사용하도록 통제하자

- 나쁜 예시

```
// 글로벌 관리자
UGameManager* GGameManager; // 전역 변수!

// 아무 함수에서나 직접 접근해 값 변경
void IncreaseScore()
{
    GGameManager->Score += 10;
}
```

- 좋은 예시

```
// 언리얼 Subsystem을 이용한 예
UCLASS()
class UScoreSystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

private:
    int32 Score;

public:
    void AddScore(int32 Amount)
    {
        Score += Amount;
        // 점수가 변경됐음을 알리는 로직
    }

    int32 GetScore() const { return Score; }
};

// 사용은 이렇게 함.
void AEnemy::OnDefeated()
{
    if (UGameInstance* GI = GetGameInstance())
    {
        // GetSubsystem<UScoreSystem>() 쓰는 곳만 접근 가능
        if (UScoreSystem* ScoreSys = GI->GetSubsystem<UScoreSystem>())
        {
            ScoreSys->AddScore(50);
        }
    }
}
```


####  가변 데이터(Mutable Data)

- **값이 자주 바뀌면 예기치 못한 오류나 복잡도가 증가한다**
- 변경 가능한 범위를 최소화하고, 가급적 불변 데이터를 활용하자
- 수정이 필요한 부분을 명확히 나누는 습관

- 나쁜 예시

```
class APlayerCharacter : public ACharacter
{
public:
    // 마음대로 바꿀 수 있는 공공재(!)
    float Health;
    int32 Level;
};

void SomeRandomFunc(APlayerCharacter* Player)
{
    Player->Health = 99999.f;
    Player->Level = 999;
    // 이걸 발견하면, 팀원들 열받음.
}
```

- 좋은 예시

```
class APlayerCharacter : public ACharacter
{
private:
        UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Stats") // 언리얼 예시
    float Health;
    int32 Level;

public:
    float GetHealth() const { return Health; }
    int32 GetLevel() const { return Level; }

    void TakeDamage(float Amount)
    {
        Health = FMath::Max(0.0f, Health - Amount);
        // 데미지 받은 로직은 여기에만!
    }

    void LevelUp()
    {
        Level++;
        Health = 100.f * Level;
    }
};
```


#### 뒤엉킨 변경(Divergent Change)

- **한 모듈이 여러 이유로 자주 수정되어야 하면 복잡해짐**
- 다른 맥락의 동작은 각각 다른 모듈로 분리해 단일 책임을 지키자
- 필요에 따라 단계를 나누고 클래스를 쪼개 이해하기 쉽게 만들자

- 나쁜 예시

```
class AGameManager : public AActor
{
public:
    // (1) 데이터 관련
    void LoadPlayerData();
    void SavePlayerData();

    // (2) 게임플레이 관련
    void StartNewGame();
    void SpawnEnemies();

private:
    // (1) 데이터 관련 필드
    FString SaveFilePath;

    // (2) 게임플레이 관련 필드
    TArray<AEnemy*> ActiveEnemies;
};
```

- 좋은 예시

```
// (1) 데이터 전용 클래스
class UPlayerDataManager : public UGameInstanceSubsystem
{
public:
    void LoadPlayerData();
    void SavePlayerData();
    // ...
};

// (2) 게임플레이 전용 클래스
class UGameplayManager : public UGameInstanceSubsystem
{
public:
    void StartNewGame();
    void SpawnEnemies();
    // ...
};
```


#### 샷건 수술(Shotgun Surgery)

- **작은 변경을 위해 여러 곳을 동시에 수정해야 하면 골치 아픔**
- **관련된 것들은 한 군데로 모아 수정 범위를 좁힌다**
- 산재된 수정 포인트가 많을수록 버그가 쉽게 발생하고 찾기 어렵다

- 나쁜 예시

```
class APlayerCharacter : public ACharacter
{
public:
    void TakeDamage(float Amount)
    {
        // 데미지 로직 1
    }
};

class AWeapon : public AActor
{
public:
    float CalculateDamage()
    {
        // 데미지 로직 2
        return 0.0f;
    }
};

class AMyGameMode : public AGameModeBase
{
public:
    void UpdateDamageLeaderboard()
    {
        // 데미지 로직 3
    }
};
```

- 좋은 예시

```
class UDamageSystem : public UObject
{
public:
    // 데미지 계산 로직을 한 군데 모음!
    float CalculateDamage(AWeapon* Weapon, ACharacter* Target);
    void ApplyDamage(AWeapon* Weapon, ACharacter* Target);
    void UpdateDamageLeaderboard(ACharacter* Damager, ACharacter* Target, float Amount);
};
```


#### 기능 편애(Feature Envy)

- **어떤 함수가 자기 객체보다 남의 객체 기능이나 데이터와 더 많이 소통한다면?**
- **그 함수를 데이터가 있는 곳으로 옯겨 의존성을 줄이자**
- 서로 가까운 기능끼리 모여야 코드가 자연스럽고 관리도 수월해진다

- 나쁜 예시

```
class UDamageCalculator : public UObject
{
public:
    float CalculateDamageReduction(AMyCharacter* Character, float Damage)
    {
        // Character의 정보를 훨씬 더 많이 사용!
        float HealthPercent = Character->GetHealth() / Character->GetMaxHealth();
        float ArmorFactor   = Character->GetArmor() * 0.1f;
        // ...
        return Damage * (1.0f - ArmorFactor * HealthPercent);
    }
};
```

- 좋은 예시

```
class AMyCharacter : public ACharacter
{
public:
    float CalculateDamageReduction(float Damage) const
    {
        float HealthPercent = Health / MaxHealth;
        float ArmorFactor   = Armor * 0.1f;
        // ...
        return Damage * (1.0f - ArmorFactor * HealthPercent);
    }
};

class UDamageCalculator : public UObject
{
public:
    float CalculateDamageReduction(AMyCharacter* Character, float Damage)
    {
        // 캐릭터가 스스로 계산하게끔 위임!
        return Character->CalculateDamageReduction(Damage);
    }
};
```


#### 데이터 뭉치(Data Clumps)

- **자주 함께 쓰이는 데이터는 하나로 묶이면 의미가 명확해짐**
- **중복되는 필드나 매개변수 그룹은 별도 구조로 분리하자**
- **비슷한 데이터끼리** 모아놓자

- 나쁜 예시

```
void FireWeapon(float Damage, float Range, float Accuracy);
void ShowWeaponStats(float Damage, float Range, float Accuracy);
void UpgradeWeapon(float& Damage, float& Range, float& Accuracy);
```

- 좋은 예시

```
// 무기 스탯 구조체
USTRUCT(BlueprintType)
struct FWeaponStats
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Damage;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Range;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Accuracy;
};

void FireWeapon(const FWeaponStats& Stats);
void ShowWeaponStats(const FWeaponStats& Stats);
void UpgradeWeapon(FWeaponStats& Stats);
```


#### 기본형 집착(Primitive Obsession)

- 복잡한 데이터를 단순한 기본형 (int, string 등)에 과도하게 의존하는 경향
- **복잡한 개념은 기본형 대신 클래스나, 구조체를 사용해서 차라리 해결하자**
- 타임 설계를 통해 복잡한 로직과 버그 발생을 줄일 수 있다

- 나쁜 예시

```
float Health;
float MaxHealth;

FString PhoneNumber; // 형식 검증이 전혀 없음
```

- 좋은 예시

```
// 체력을 표현하는 클래스
class FHealth
{
public:
    FHealth(float InCurrent, float InMax)
        : Current(FMath::Clamp(InCurrent, 0.f, InMax)), Max(InMax) {}

    void ApplyDamage(float Amount)
    {
        Current = FMath::Max(0.f, Current - Amount);
    }

    float Get() const { return Current; }

private:
    float Current;
    float Max;
};

// FHealth를 사용해보자
class AMyCharacter : public ACharacter
{
public:
    // 이렇게 FHealth를 씀.
    FHealth Health = FHealth(100.f, 100.f);

    void TakeHit(float Damage)
    {
        Health.ApplyDamage(Damage);

        if (Health.Get() <= 0.f)
        {
            Die();
        }
    }

private:
    void Die()
    {
        // 사망 처리 로직
    }
};
```


#### 반복되는 스위치문(Repeated Switches)

- 새로운 분기가 생길 때마다 여러 switch문을 전부 수정해야 한다면 비효율적이다
- 다형성 구조를 적용해 중복되는 분기 로직을 없애자
- **그냥 switch문을 쓰지말자**

- 나쁜 예시

```
switch (WeaponType)
{
    case EWeaponType::Sword:
        return DoSwordAttack();
    case EWeaponType::Bow:
        return DoBowAttack();
    case EWeaponType::Gun:
        return PewPew();
}
```

- 좋은 예시

```
// 다형성 활용...!
// 무기 베이스
class AWeapon : public AActor
{
public:
    virtual void Attack();
};

// 무기별 클래스
class ASword : public AWeapon
{
public:
    virtual void Attack() override { /* 칼 공격 로직 */ }
};

class ABow : public AWeapon
{
public:
    virtual void Attack() override { /* 활 공격 로직 */ }
};
```

```
// 그리고 캐릭터 쪽에서는 더 이상 switch 안 씀.
void AMyCharacter::UseWeapon()
{
    if (EquippedWeapon)
    {
        EquippedWeapon->Attack(); // 알아서 잘함
    }
}
```


#### 반복문(Loop)

- **루프 안에 비즈니스 로직을 다 넣지 말자**
- 반복문은 성능 저하의 원인
- **중첩 반복문은 왠만하면 피해야 함**

- 나쁜 예시

```
// 인벤토리에서 무거운 아이템을 찾아서 무게를 계산하는 과정
void ProcessHeavyItems()
{
    TArray<UItem*> Items = GetAllItems();
    TArray<UItem*> HeavyItems;

    // (1) 무거운 아이템 골라내기
    for (int32 i = 0; i < Items.Num(); i++)
    {
        if (Items[i]->Weight > 10.f)
        {
            HeavyItems.Add(Items[i]);
        }
    }

    // (2) 무게 총합 계산
    float TotalWeight = 0.f;
    for (int32 j = 0; j < HeavyItems.Num(); j++)
    {
        TotalWeight += HeavyItems[j]->Weight;
    }

    // (3) 너무 무거우면 효과 적용
    if (TotalWeight > 50.f)
    {
        ApplySlowEffect();
    }
}
```

- 좋은 예시

```
void ProcessHeavyItems()
{
    // 모든 아이템 가져오기
    TArray<UItem*> Items = GetAllItems();

    // 무게 10 이상인 아이템만 필터링
    TArray<UItem*> HeavyItems = GetHeavyItems(Items);

    // 필터링된 아이템의 총 무게 계산
    float TotalWeight = GetTotalWeight(HeavyItems);

    // 총 무게가 기준치를 초과하면 느려지는 효과 적용
    if (IsTooHeavy(TotalWeight))
    {
        ApplySlowEffect();
    }
}

// 무거운 아이템만 골라내는 함수
TArray<UItem*> GetHeavyItems(const TArray<UItem*>& Items)
{
    TArray<UItem*> Result;
    for (UItem* Item : Items)
    {
        if (Item && Item->Weight > 10.f)
        {
            Result.Add(Item);
        }
    }
    return Result;
}

// 아이템 배열의 총 무게를 계산하는 함수
float GetTotalWeight(const TArray<UItem*>& Items)
{
    float Total = 0.f;
    for (UItem* Item : Items)
    {
        if (Item)
        {
            Total += Item->Weight;
        }
    }
    return Total;
}

// 너무 무거운지 판단하는 기준 함수
bool IsTooHeavy(float Weight)
{
    return Weight > 50.f;
}
```


#### 게으른 요소(Lazy Element)

- 하는 일 없이 존재만 하는 메서드나 클래스는 오히려 혼동을 줄 뿐
- **코드 흐름상 실제로 필요 없는 구조는 과감히 없애자. 지우기 귀찮아도 삭제하자**
- **단순화, 단순화, 단순화 ...**

- 나쁜 예시

```
// 과도하게 중간함수만 존재
class AProjectile : public AActor
{
public:
    void Launch(const FVector& Dir, float Speed)
    {
        // 여기서 다시 다른 함수를 호출만 함
        LaunchProjectile(Dir, Speed);
    }

private:
    void LaunchProjectile(const FVector& Dir, float Speed)
    {
        // 실제 로직
        ProjectileMovement->Velocity = Dir * Speed;
    }
};
```

- 좋은 예시

```
class AProjectile : public AActor
{
public:
    void Launch(const FVector& Dir, float Speed)
    {
        ProjectileMovement->Velocity = Dir * Speed;
    }

private:
    UProjectileMovementComponent* ProjectileMovement;
};
```


#### 추측성 일반화(Speculative Generality)

- **현재 필요한 기능에 집중해 불필요한 추상화를 걷어내자**
- **미래 대비보다 현재 문제 해결이 우선**
- "나중에 필요할 수도 있어"라는 생각으로 만든 코드는 대부분 짐이 된다

- 나쁜 예시

```
// 엄청나게 확장 가능한 무기 클래스... 그런데 전혀 안 씀
class AWeapon : public AActor
{
public:
    virtual void APlayer::PlayWeaponSound()
{
    USoundBase* AttackSound = GetEquippedWeaponSound();
    if (AttackSound)
    {
        UGameplayStatics::PlaySound2D(this, AttackSound);
    }
}

USoundBase* APlayer::GetEquippedWeaponSound()
{
    // 아래 호출부에서 직접 소리를 반환
    return Inventory ? Inventory->GetAttackSound() : nullptr;
}

USoundBase* UInventoryComponent::GetAttackSound()
{
    if (!EquippedWeapon) return nullptr;
    return EquippedWeapon->GetAttackSound();
}

USoundBase* AWeapon::GetAttackSound()
{
    return SoundData ? SoundData->AttackSound : nullptr;
}ttack();
    virtual void SpecialAttack();   // 안 씀
    virtual void UltimateAttack();  // 안 씀
    virtual void ElementalAttack(); // 안 씀
    // ...

    void SetDamage(float BaseDamage, float Crit, float Splash, float Chain, float Summon);
    // TODO: 추후에 쓸 수도?
};
```

- 좋은 예시

```
class AWeapon : public AActor
{
public:
    // 필요한 기능만
    void Attack();
    void SetDamage(float InDamage);

private:
    float Damage;
};

// 필요할 때 다른 무기 타입을 '상속'해서 만듦
class AMagicWeapon : public AWeapon
{
    void ElementalAttack();
};
```


#### 임시 필드(Temporary Field)

- **목적이 분명치 않는 필드는 코드 복잡도를 높이는 원인**
- 특정 상황에서만 쓰이는 필드는 다른 상황에선 쓸데없는 혼란을 부를 뿐
- **사용되지 않는 시점이 더 많다면 다른 구조로 옮기거나 클래스로 분리하자**

- 나쁜 예시

```
class AEnemy : public ACharacter
{
public:
    // 일반 공격
    float Health;

    // 원거리 공격 전용 (근접 적은 안 씀)
    float ProjectileSpeed;
    UParticleSystem* ProjectileEffect;

    // 텔레포트 전용 (다른 적은 안 씀)
    float TeleportCooldown;
    float LastTeleportTime;
};
```

- 좋은 예시

```
// "컴포넌트"로 분리
class URangedAttackComponent : public UActorComponent
{
    float ProjectileSpeed;
    void ExecuteAttack();
};

class UTeleportComponent : public UActorComponent
{
    float TeleportCooldown;
    void ExecuteTeleport();
};

// 적 캐릭터
class AEnemy : public ACharacter
{
    float Health;
    URangedAttackComponent* RangedComp;   // 원거리 적만 붙임
    UTeleportComponent* TeleportComp;     // 텔레포트 적만 붙임
};
```


#### 메시지 체인(Message Chains)

- **클래스도 프라이버시가 있다**
- **객체를 줄줄이 호출하면 내부 구조가 노출돼 결합도가 커짐**
- 필요하다면 최종 로직을 호출부 가까이로 옮겨 의존을 줄이자

- 나쁜 예시

```
// 길~~게 이어진 참조
void APlayer::PlayWeaponSound()
{
    if (Inventory
        && Inventory->EquippedWeapon
        && Inventory->EquippedWeapon->SoundData
        && Inventory->EquippedWeapon->SoundData->AttackSound)
    {
        UGameplayStatics::PlaySound2D(this, Inventory->EquippedWeapon->SoundData->AttackSound);
    }
}
```

- 좋은 예시

```
void APlayer::PlayWeaponSound()
{
    USoundBase* AttackSound = GetEquippedWeaponSound();
    if (AttackSound)
    {
        UGameplayStatics::PlaySound2D(this, AttackSound);
    }
}

// 플레이어는 인벤토리한테만 물어봄
USoundBase* APlayer::GetEquippedWeaponSound()
{
    // 아래 호출부에서 직접 소리를 반환
    return Inventory ? Inventory->GetAttackSound() : nullptr;
}

// 인벤토리는 무기한테만 물어봄
USoundBase* UInventoryComponent::GetAttackSound()
{
    if (!EquippedWeapon) return nullptr;
    return EquippedWeapon->GetAttackSound();
}

// 무기는 사운드만 알고 있음
USoundBase* AWeapon::GetAttackSound()
{
    return SoundData ? SoundData->AttackSound : nullptr;
}
```


#### 중재자(Middle Man)

- 실질적 로직 없이 위임만 하는 클래스는 존재 가치가 의심
- **직접 연결해도 문제가 없다면 중간 단계를 제거하자**
- **늘 직관적 구조로 수정하자**

- 나쁜 예시

```
class AMyPlayerController : public APlayerController
{
public:
    void MoveForward(float Value)  { Character->MoveForward(Value); }
    void MoveRight(float Value)    { Character->MoveRight(Value); }
    void Jump()                    { Character->Jump(); }
    void StartFire()               { Character->StartFire(); }
    void StopFire()                { Character->StopFire(); }
    // ...

private:
    AMyCharacter* Character;
};
```

- 좋은 예시

```
// 직접 캐릭터에 입력 바인딩
void AMyPlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();

    // 현재 캐릭터 가져오기
    AMyCharacter* MyChar = Cast<AMyCharacter>(GetCharacter());
    if (MyChar && InputComponent)
    {
        // 캐릭터가 필요한 입력을 직접 바인딩
        MyChar->SetupPlayerInput(InputComponent);
    }
}

void AMyCharacter::SetupPlayerInput(UInputComponent* PlayerInputComponent)
{
    PlayerInputComponent->BindAxis("MoveForward", this, &AMyCharacter::MoveForward);
    PlayerInputComponent->BindAxis("MoveRight", this, &AMyCharacter::MoveRight);
    // ...
}
```


#### 내부자 거래(Insider Trading)

- 모듈 간에 비공개 데이터가 과하게 오가면 결합도가 높아짐
- **필요한 정보만 교환할 수 있게 인터페이스 범위를 명확히 정의하자**
- **모듈 간 벽을 두껍게 유지해 각자 책임을 분리해야함**

- 나쁜 예시

```
// AEnemy가 APlayerCharacter의 내부 변수까지 막 참조
void AEnemy::Attack(APlayerCharacter* Player)
{
    if (!Player->bIsInvulnerable)
    {
        float Damage = AttackDamage - Player->EquippedArmor->DamageReduction;
        Player->CurrentHealth -= Damage;

        // UI도 직접 갱신?!
        Player->PlayerHUD->UpdateHealthBar(Player->CurrentHealth, Player->MaxHealth);
    }
}
```

- 좋은 예시

```
void AEnemy::Attack(APlayerCharacter* Player)
{
    if (Player && Player->CanBeAttacked())
    {
        Player->ReceiveDamage(AttackDamage);
    }
}

// Player 쪽 내부 함수들 1
bool APlayerCharacter::CanBeAttacked() const
{
    return !bIsInvulnerable;
}

// Player 쪽 내부 함수들 2
void APlayerCharacter::ReceiveDamage(float IncomingDamage)
{
    float FinalDamage = EquippedArmor ? EquippedArmor->ApplyReduction(IncomingDamage) : IncomingDamage;
    CurrentHealth = FMath::Clamp(CurrentHealth - FinalDamage, 0.f, MaxHealth);

    UpdateHUD();
}

// Player 쪽 내부 함수들 3
void APlayerCharacter::UpdateHUD()
{
    if (PlayerHUD)
    {
        PlayerHUD->UpdateHealthBar(CurrentHealth, MaxHealth);
    }
}
```


#### 거대한 클래스(Large Class)

- **너무 많은 책임을 지는 클래스는 필드와 메서드가 폭발적으로 늘어난다**
- **중복이 생기고 관리가 어려워지므로 역할이나 기능별로 분리하자**
- 사용 패턴을 분석해 클래스를 쪼개면 유지보수가 훨씬 수월해짐

- 나쁜 예시

```
class AGameCharacter : public ACharacter
{
public:
    // 이동 처리
    void MoveForward(float Value);
    void MoveRight(float Value);

    // 전투 처리
    void Attack();
    void Reload();

    // 인벤토리 처리
    void AddItem(UItem* Item);
    void RemoveItem(UItem* Item);

    // 퀘스트 처리
    void AcceptQuest(UQuest* Quest);
    void CompleteQuest(UQuest* Quest);

    // 대화 처리
    void StartDialogue();
    void EndDialogue();
    // ... 500줄 넘게 계속 ...
};
```

- 좋은 예시

```
class AGameCharacter : public ACharacter
{
public:
    AGameCharacter();
    // 핵심 동작만 유지, 나머지는 컴포넌트에 맡김

private:
    UPROPERTY()
    UMovementComponent* MovementComp;

    UPROPERTY()
    UCombatComponent* CombatComp;

    UPROPERTY()
    UInventoryComponent* InventoryComp;

    UPROPERTY()
    UQuestComponent* QuestComp;
    // ...
};
```


#### 서로 다른 인터페이스의 대안 클래스들(Alternative Classes with Different Interfaces)

- **클래스를 교체하려면 인터페이스가 호환되어야 함**
- **유사 기능 클래스끼리 일관된 형식을 갖추는 것이 좋음**
- 메서드 시그니처를 통일해 교체 가능성을 높이자

-  나쁜 예시

```
class ARangedWeapon
{
public:
    void FireProjectile();
    void Reload();
};

class AMeleeWeapon
{
public:
    void PerformAttack();
    void SharpenBlade();
};

// 플레이어 캐릭터
void APlayerCharacter::Attack()
{
    if (CurrentRangedWeapon)
        CurrentRangedWeapon->FireProjectile();
    else if (CurrentMeleeWeapon)
        CurrentMeleeWeapon->PerformAttack();
}
```

- 좋은 예시

```
class AWeapon : public AActor
{
public:
    virtual void Attack() = 0;  // 추상 메서드
    virtual void Reload() {}    // 기본 구현(근접 무기는 비워둘 수도)
};

class ARangedWeapon : public AWeapon
{
public:
    virtual void Attack() override { /* 원거리 공격 */ }
    virtual void Reload() override { /* 탄약 보충 */ }
};

class AMeleeWeapon : public AWeapon
{
public:
    virtual void Attack() override { /* 근접 공격 */ }
    // Reload()는 오버라이드 안 해도 됨(불필요)
};

// 캐릭터는 이제 딱 한 줄로 호출
void APlayerCharacter::Attack()
{
    if (CurrentWeapon)
    {
        CurrentWeapon->Attack(); // 무기 종류 관계없이 한 번에 호출
    }
}
```


#### 데이터 클래스(Data Class)

- 필드와 게터/세터만 있는 클래스는 다른 곳에서 함부로 조작되기 쉬움
- **변경될 필요가 없는 필드는 세터를 제거해 안정성을 높이자**
- 필요 기능이 있다면 이 클래스 안에 직접 구현해 응집도를 높이자

- 나쁜 예시

```
class FPlayerStats
{
public:
    float GetHealth() const { return Health; }
    void SetHealth(float H) { Health = H; }

private:
    float Health;
    float MaxHealth;
};

// 플레이어가 데미지를 주면서 stats를 수동 조작
void APlayerCharacter::TakeDamage(float Damage)
{
    float NewHealth = PlayerStats.GetHealth() - Damage;
    PlayerStats.SetHealth(FMath::Max(0.f, NewHealth));
}
```

- 좋은 예시

```
class FPlayerStats
{
public:
    // 함수 안에서 로직 처리
    void ApplyDamage(float Damage)
    {
        float ActualDamage = Damage * (1.0f - Defense / 100.f);
        Health = FMath::Max(0.f, Health - ActualDamage);
    }

    bool IsDead() const { return Health <= 0.f; }

private:
    float Health;
    float Defense;
};
```

```
// 플레이어
void APlayerCharacter::TakeDamage(float Damage)
{
    PlayerStats.ApplyDamage(Damage);
    if (PlayerStats.IsDead())
    {
        Die();
    }
}
```


#### 상속 포기(Refused Bequest)

- 서브클래스가 부모의 기능 중 일부만 필요하거나 인터페이스가 맞지 않는다면?
- **꼭 상속하지 않고, 필요한 부분만 다른 방식으로 얻을 수 있다**
- **위임 등으로 불필요한 유산을 거부해 구조를 단순화하자**

- 나쁜 예시

```
class AWeapon
{
public:
    virtual void Attack();
    virtual void Reload(); // 근접 무기는 재장전 필요 X
};

class AMeleeWeapon : public AWeapon
{
public:
    virtual void Reload() override
    {
        // 근접 무기에선 의미가 없으니 비워둠
    }
};
```

- 좋은 예시

```
class ABaseWeapon : public AActor
{
public:
    virtual void Attack() = 0; // 모든 무기는 공격 기능
};

class ARangedWeapon : public ABaseWeapon
{
public:
    virtual void Attack() override { /* 발사 로직 */ }
    void Reload() { /* 탄약 보충 */ }
};

class AMeleeWeapon : public ABaseWeapon
{
public:
    virtual void Attack() override { /* 근접 공격 로직 */ }
    // Reload() 자체가 없음!
};
```


#### 주석(Comments)

- 물론 올부른 주석은 아주 좋다
- **그러나 코드만으로 명확하게 이해되는게 더 좋다. 주석은 사실 코드를 변명하기 위한 장치에 가깝다**
- 즉, 주석이 필요한 상황일 경우, 주석이 필요없는 코드로 먼저 바꾸는게 우선임

- 나쁜 예시

```
void AEnemy::UpdateBehavior()
{
    // 1. 플레이어 위치 가져오기
    // 2. 시야 범위 확인
    // 3. 시야 각도 계산
    // 4. 라인 트레이스 해서 장애물 있는지
    // 5. 없으면 공격, 있으면 패트롤
    // 50줄짜리 함수에 각 단계별 설명이 잔뜩 → 너무 복잡.
    ...
}
```

- 좋은 예시

```
void AEnemy::UpdateBehavior()
{
    if (CanSeePlayer())
    {
        EngagePlayer();
    }
    else
    {
        PatrolArea();
    }
}

bool AEnemy::CanSeePlayer()
{
    return IsWithinSightRange() && IsInFieldOfView() && HasLineOfSight();
}
```